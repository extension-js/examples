/**
 * Minimal JSON Schema validator (subset)
 *
 * Mirrors the subset used in extension-dev/extension-artifacts.
 * Keeps examples repo dependency-free.
 */

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function checkType(schemaType, value) {
  switch (schemaType) {
    case 'object':
      return isObject(value)
    case 'array':
      return Array.isArray(value)
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'null':
      return value === null
    default:
      return true
  }
}

export function validateMiniJsonSchema(schema, value, path = '$') {
  const errors = []
  if (!schema || typeof schema !== 'object') return errors
  if (!schema.__root) schema.__root = schema

  if (schema.const !== undefined) {
    if (value !== schema.const) {
      errors.push({
        path,
        message: `Expected const ${JSON.stringify(schema.const)}`
      })
      return errors
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Expected one of ${JSON.stringify(schema.enum)}`
      })
      return errors
    }
  }

  if (schema.oneOf) {
    const branches = Array.isArray(schema.oneOf) ? schema.oneOf : []
    const ok = branches.some(
      (s) => validateMiniJsonSchema(s, value, path).length === 0
    )
    if (!ok)
      errors.push({path, message: 'Value does not match any oneOf schemas'})
    return errors
  }

  if (schema.anyOf) {
    const branches = Array.isArray(schema.anyOf) ? schema.anyOf : []
    const ok = branches.some(
      (s) => validateMiniJsonSchema(s, value, path).length === 0
    )
    if (!ok)
      errors.push({path, message: 'Value does not match any anyOf schemas'})
    return errors
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const ok = types.some((t) => checkType(String(t), value))
    if (!ok) {
      errors.push({
        path,
        message: `Expected type ${JSON.stringify(schema.type)}`
      })
      return errors
    }
  }

  if (typeof schema.minLength === 'number' && typeof value === 'string') {
    if (value.length < schema.minLength)
      errors.push({path, message: `Expected minLength ${schema.minLength}`})
  }
  if (typeof schema.minimum === 'number' && typeof value === 'number') {
    if (value < schema.minimum)
      errors.push({path, message: `Expected minimum ${schema.minimum}`})
  }
  if (typeof schema.minItems === 'number' && Array.isArray(value)) {
    if (value.length < schema.minItems)
      errors.push({path, message: `Expected minItems ${schema.minItems}`})
  }
  if (typeof schema.pattern === 'string' && typeof value === 'string') {
    try {
      const re = new RegExp(schema.pattern)
      if (!re.test(value))
        errors.push({path, message: `Expected pattern ${schema.pattern}`})
    } catch {
      // ignore
    }
  }

  if (schema.$ref && typeof schema.$ref === 'string') {
    // Local refs only: "#/$defs/..."
    if (schema.$ref.startsWith('#/')) {
      const parts = schema.$ref.slice(2).split('/')
      let cur = schema.__root || schema
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
        else cur = undefined
      }
      if (cur)
        return validateMiniJsonSchema(
          {...cur, __root: schema.__root || schema},
          value,
          path
        )
    }
  }

  if (schema.type === 'object' && isObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const k of required) {
      if (!(k in value) || value[k] === undefined) {
        errors.push({
          path: `${path}.${k}`,
          message: 'Missing required property'
        })
      }
    }
    const props = isObject(schema.properties) ? schema.properties : {}
    for (const [k, s] of Object.entries(props)) {
      if (k in value && value[k] !== undefined) {
        errors.push(
          ...validateMiniJsonSchema(
            {...s, __root: schema.__root || schema},
            value[k],
            `${path}.${k}`
          )
        )
      }
    }
    const additional = schema.additionalProperties
    if (additional === false) {
      for (const k of Object.keys(value)) {
        if (!(k in props))
          errors.push({
            path: `${path}.${k}`,
            message: 'Additional properties not allowed'
          })
      }
    } else if (isObject(additional)) {
      for (const k of Object.keys(value)) {
        if (!(k in props) && value[k] !== undefined) {
          errors.push(
            ...validateMiniJsonSchema(
              {...additional, __root: schema.__root || schema},
              value[k],
              `${path}.${k}`
            )
          )
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(
          ...validateMiniJsonSchema(
            {...schema.items, __root: schema.__root || schema},
            value[i],
            `${path}[${i}]`
          )
        )
      }
    }
  }

  return errors
}
