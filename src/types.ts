// 表单字段配置
export interface FieldConfig {
  id: string; // 唯一标识
  selector: string; // CSS 选择器
  value: string; // 填充值
  label: string; // 显示标签（如：用户名、密码）
}

// 环境配置
export interface EnvConfig {
  id: string;
  name: string; // 环境名称
  loginUrl: string; // 必填: 登录页 URL
  fields: FieldConfig[]; // 自定义字段列表
  loginButtonSelector?: string; // 可选: 登录按钮选择器（用于自动点击登录）
}

// 面板位置配置
export interface PanelPosition {
  x: number;
  y: number;
}

// 全局配置
export interface AppConfig {
  environments: EnvConfig[];
  currentEnvId?: string;
  panelPosition?: PanelPosition;
  allowedDomains?: string[]; // 允许显示的域名列表（如：example.com, *.example.com）
}

// 选择模式
export type SelectMode = "field" | "loginButton" | null;

// 选择回调
export interface SelectionCallback {
  fieldId?: string; // 正在选择的字段 ID
  isLoginButton?: boolean; // 是否选择登录按钮
  envId: string; // 环境 ID
}
