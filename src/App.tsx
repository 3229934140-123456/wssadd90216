import { useState } from 'react'
import FileImport from './components/FileImport'
import RuleConfig from './components/RuleConfig'
import AutoMatch from './components/AutoMatch'
import ExceptionQueue from './components/ExceptionQueue'
import Settlement from './components/Settlement'
import Archive from './components/Archive'

const menuItems = [
  { key: 'import', label: '文件导入', icon: '📁' },
  { key: 'rules', label: '规则配置', icon: '⚙️' },
  { key: 'match', label: '自动匹配', icon: '🔗' },
  { key: 'exceptions', label: '异常队列', icon: '⚠️' },
  { key: 'settlement', label: '结算单', icon: '💰' },
  { key: 'archive', label: '归档查询', icon: '📂' }
]

const titles: Record<string, string> = {
  import: '文件导入',
  rules: '规则配置',
  match: '自动匹配',
  exceptions: '异常队列',
  settlement: '结算单',
  archive: '归档查询'
}

export default function App() {
  const [activeKey, setActiveKey] = useState('import')

  const renderContent = () => {
    switch (activeKey) {
      case 'import':
        return <FileImport />
      case 'rules':
        return <RuleConfig />
      case 'match':
        return <AutoMatch />
      case 'exceptions':
        return <ExceptionQueue />
      case 'settlement':
        return <Settlement />
      case 'archive':
        return <Archive />
      default:
        return <FileImport />
    }
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          达人佣金结算系统
        </div>
        <div className="sidebar-menu">
          {menuItems.map(item => (
            <div
              key={item.key}
              className={`menu-item ${activeKey === item.key ? 'active' : ''}`}
              onClick={() => setActiveKey(item.key)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="content">
        <div className="content-header">
          <div className="content-title">{titles[activeKey]}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="text-muted text-small">结算周期：2025年6月</span>
          </div>
        </div>
        <div className="content-body">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
