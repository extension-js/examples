import React from 'react'
import {ConfigProvider, theme, Typography, Button, Space} from 'antd'
import {SmileOutlined} from '@ant-design/icons'
import {XProvider, ThoughtChain} from '@ant-design/x'
import iconUrl from '../images/icon.png'

const {Title, Paragraph} = Typography

export default function SidebarApp() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorBgBase: '#0a0c10',
          colorTextBase: '#c9c9c9',
          borderRadius: 6
        }
      }}
    >
      <XProvider>
        <div className="sidebar_app" data-testid="antd-root">
          <img className="sidebar_logo" src={iconUrl} alt="Ant Design" />
          <Title level={2} className="sidebar_title">
            Sidebar Panel
          </Title>
          <Paragraph className="sidebar_description">
            Built with{' '}
            <a
              href="https://ant.design"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ant Design
            </a>
            . Learn more in the{' '}
            <a
              href="https://extension.js.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Extension.js docs
            </a>
            .
          </Paragraph>
          <Space size="small" className="sidebar_actions">
            <Button type="primary" icon={<SmileOutlined />}>
              antd button
            </Button>
          </Space>
          <div className="sidebar_thoughts">
            <ThoughtChain items={[]} />
          </div>
        </div>
      </XProvider>
    </ConfigProvider>
  )
}
