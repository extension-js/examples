import stylistic from '@stylistic/eslint-plugin'

const BANNER_ART = /[█╔╗╚╝║]/
const DECORATION_ONLY = /^\s*[-─━═=~*#]{3,}\s*$/
const DASH_WRAPPED_TITLE = /^\s*-{2,}\s+(.*?)\s+-{2,}\s*$/
const BOX_RULE = /[─━═]{3,}/
const BOX_EDGES = /^[\s─━═]+|[\s─━═]+$/g

const bannerOption = [
  {
    type: 'object',
    properties: {allowBanner: {type: 'boolean'}},
    additionalProperties: false
  }
]

function ownsLines(sourceCode, comment) {
  const before = sourceCode.lines[comment.loc.start.line - 1].slice(
    0,
    comment.loc.start.column
  )
  const after = sourceCode.lines[comment.loc.end.line - 1].slice(
    comment.loc.end.column
  )

  return before.trim() === '' && after.trim() === ''
}

function lineRange(sourceCode, startLine, endLine) {
  const start = sourceCode.getIndexFromLoc({line: startLine, column: 0})
  const end =
    endLine < sourceCode.lines.length
      ? sourceCode.getIndexFromLoc({line: endLine + 1, column: 0})
      : sourceCode.text.length

  return [start, end]
}

function removeComment(fixer, sourceCode, comment) {
  if (!ownsLines(sourceCode, comment)) return fixer.remove(comment)

  return fixer.removeRange(
    lineRange(sourceCode, comment.loc.start.line, comment.loc.end.line)
  )
}

function isTagOnlyJsdoc(comment) {
  return (
    comment.type === 'Block' &&
    comment.value.startsWith('*') &&
    jsdocLines(comment).every((line) => line.text === '' || line.isTag)
  )
}

function jsdocLines(comment) {
  let inTags = false

  return comment.value
    .slice(1)
    .split('\n')
    .map((raw) => {
      const text = raw.replace(/^\s*\*?\s?/, '').trim()
      if (text.startsWith('@')) inTags = true

      return {raw, text, isTag: inTags && text !== ''}
    })
}

const blankLineAfterShebang = {
  meta: {type: 'layout', fixable: 'whitespace', schema: []},
  create(context) {
    return {
      Program() {
        const lines = context.sourceCode.lines
        if (!lines[0]?.startsWith('#!') || lines.length < 2) return
        if (lines[1].trim() === '') return

        context.report({
          loc: {line: 1, column: 0},
          message: 'Expected a blank line after the shebang.',
          fix: (fixer) => fixer.insertTextAfterRange([0, lines[0].length], '\n')
        })
      }
    }
  }
}

const noFileHeaderComment = {
  meta: {type: 'suggestion', fixable: 'code', schema: bannerOption},
  create(context) {
    const allowBanner = context.options[0]?.allowBanner ?? false
    const {sourceCode} = context

    return {
      Program(node) {
        const first = sourceCode.getFirstToken(node)
        if (!first) return

        const header = sourceCode
          .getAllComments()
          .filter((comment) => comment.type !== 'Shebang')
          .filter((comment) => comment.range[0] < first.range[0])
          .filter((comment) => !/^\s*(eslint|global|@ts-)/.test(comment.value))
          .filter((comment) => !/^\/\s*<reference/.test(comment.value))
          .filter((comment) => !isTagOnlyJsdoc(comment))
          .filter((comment) => !(allowBanner && BANNER_ART.test(comment.value)))

        if (header.length === 0) return

        context.report({
          loc: {start: header[0].loc.start, end: header.at(-1).loc.end},
          message: 'Remove the file header comment.',
          fix: (fixer) =>
            header.map((comment) => removeComment(fixer, sourceCode, comment))
        })
      }
    }
  }
}

const noDividerComment = {
  meta: {type: 'suggestion', fixable: 'code', schema: bannerOption},
  create(context) {
    const allowBanner = context.options[0]?.allowBanner ?? false
    const {sourceCode} = context

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Line') continue
          if (allowBanner && BANNER_ART.test(comment.value)) continue

          const title = DECORATION_ONLY.test(comment.value)
            ? ''
            : (comment.value.match(DASH_WRAPPED_TITLE)?.[1] ??
              (BOX_RULE.test(comment.value)
                ? comment.value.replace(BOX_EDGES, '')
                : null))

          if (title === null) continue

          context.report({
            loc: comment.loc,
            message: 'Remove the section divider comment.',
            fix: (fixer) =>
              title === ''
                ? removeComment(fixer, sourceCode, comment)
                : fixer.replaceText(comment, `// ${title}`)
          })
        }
      }
    }
  }
}

const noJsdocDescription = {
  meta: {type: 'suggestion', fixable: 'code', schema: []},
  create(context) {
    const {sourceCode} = context

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            continue
          }

          const lines = jsdocLines(comment)
          if (lines.every((line) => line.text === '' || line.isTag)) continue

          const tags = lines.filter((line) => line.isTag)
          const indent = sourceCode.lines[comment.loc.start.line - 1].slice(
            0,
            comment.loc.start.column
          )

          context.report({
            loc: comment.loc,
            message: 'Remove the JSDoc description; keep only type tags.',
            fix: (fixer) =>
              tags.length === 0
                ? removeComment(fixer, sourceCode, comment)
                : fixer.replaceText(
                    comment,
                    `/**\n${tags.map((line) => line.raw).join('\n')}\n${indent} */`
                  )
          })
        }
      }
    }
  }
}

const basePadding = stylistic.rules['padding-line-between-statements']

const paddingLineBetweenStatements = {
  meta: basePadding.meta,
  create(context) {
    const {sourceCode} = context

    const report = (descriptor) => {
      const before = sourceCode.getTokenBefore(descriptor.node)
      const asiGuard =
        before?.value === ';' &&
        before.loc.start.line === descriptor.node.loc.start.line

      if (!asiGuard) context.report(descriptor)
    }

    return basePadding.create(Object.create(context, {report: {value: report}}))
  }
}

export default {
  rules: {
    'padding-line-between-statements': paddingLineBetweenStatements,
    'blank-line-after-shebang': blankLineAfterShebang,
    'no-file-header-comment': noFileHeaderComment,
    'no-divider-comment': noDividerComment,
    'no-jsdoc-description': noJsdocDescription
  }
}
