# Ant Design Sidebar Example

React sidebar that renders [antd](https://ant.design/),
[@ant-design/icons](https://ant.design/components/icon) and
[@ant-design/x](https://x.ant.design/) components.

This example exists primarily as regression coverage for
[issue #445](https://github.com/extension-js/extension.js/issues/445):
when a project sets `"type": "module"` in its `package.json`, the bundler must
still resolve `require()` calls inside CJS dependencies through the `require`
exports condition. Otherwise, packages that consume `@babel/runtime` helpers
end up loading the ESM build of `interopRequireDefault` for a CJS caller and
the page crashes at startup with
`Uncaught TypeError: _interopRequireDefault is not a function`.
