import React from 'react'
import {Button, ConfigProvider} from 'antd'
import {SmileOutlined} from '@ant-design/icons'
import {XProvider, ThoughtChain} from '@ant-design/x'

export default function SidebarApp() {
  return (
    <ConfigProvider>
      <XProvider>
        <div data-testid="antd-root" style={{padding: 24}}>
          <h1>Extension.js + Ant Design</h1>
          <p>
            Regression coverage for{' '}
            <a href="https://github.com/extension-js/extension.js/issues/445">
              issue #445
            </a>
            . Renders antd, @ant-design/icons and @ant-design/x components.
            These packages publish CJS code that consumes
            <code>@babel/runtime</code> helpers; if the bundler picks the ESM
            condition for those CJS requires, the page crashes with
            "_interopRequireDefault is not a function".
          </p>
          <Button type="primary" icon={<SmileOutlined />}>
            antd button
          </Button>
          <ThoughtChain items={[]} />
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
