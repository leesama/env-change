import type { AppConfig, EnvConfig } from "./types";

const STORAGE_KEY = "env-switch-config";

// 默认配置
const defaultConfig: AppConfig = {
  environments: [],
  currentEnvId: undefined,
  panelPosition: undefined,
  allowedDomains: [], // 空数组表示不限制域名
};

// 生成唯一 ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 检查域名是否匹配模式
function matchDomain(hostname: string, pattern: string): boolean {
  // 移除前后空格
  pattern = pattern.trim().toLowerCase();
  hostname = hostname.toLowerCase();

  // 通配符匹配：*.example.com 匹配所有子域名
  if (pattern.startsWith("*.")) {
    const baseDomain = pattern.slice(2);
    return hostname === baseDomain || hostname.endsWith("." + baseDomain);
  }

  // 精确匹配
  return hostname === pattern;
}

// 检查当前页面是否在允许的域名列表中
export function isCurrentDomainAllowed(
  allowedDomains: string[] | undefined
): boolean {
  // 如果没有配置或为空数组，表示不限制（显示在所有页面）
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  const hostname = window.location.hostname;
  return allowedDomains.some((pattern) => matchDomain(hostname, pattern));
}

// 保存允许的域名列表
export async function saveAllowedDomains(domains: string[]): Promise<void> {
  const config = await loadConfig();
  config.allowedDomains = domains;
  await saveConfig(config);
}

// 加载配置
export async function loadConfig(): Promise<AppConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const config = result[STORAGE_KEY] as AppConfig | undefined;
      resolve(config || defaultConfig);
    });
  });
}

// 保存配置
export async function saveConfig(config: AppConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
      resolve();
    });
  });
}

// 添加环境
export async function addEnv(env: Omit<EnvConfig, "id">): Promise<EnvConfig> {
  const config = await loadConfig();
  const newEnv: EnvConfig = {
    ...env,
    id: generateId(),
  };
  config.environments.push(newEnv);
  await saveConfig(config);
  return newEnv;
}

// 更新环境
export async function updateEnv(env: EnvConfig): Promise<void> {
  const config = await loadConfig();
  const index = config.environments.findIndex((e) => e.id === env.id);
  if (index !== -1) {
    config.environments[index] = env;
    await saveConfig(config);
  }
}

// 删除环境
export async function deleteEnv(envId: string): Promise<void> {
  const config = await loadConfig();
  config.environments = config.environments.filter((e) => e.id !== envId);
  if (config.currentEnvId === envId) {
    config.currentEnvId = undefined;
  }
  await saveConfig(config);
}

// 设置当前环境
export async function setCurrentEnv(envId: string | undefined): Promise<void> {
  const config = await loadConfig();
  config.currentEnvId = envId;
  await saveConfig(config);
}

// 保存面板位置
export async function savePanelPosition(x: number, y: number): Promise<void> {
  const config = await loadConfig();
  config.panelPosition = { x, y };
  await saveConfig(config);
}

// 导出配置为 JSON
export function exportConfig(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

// 从 JSON 导入配置
export function importConfig(jsonString: string): AppConfig | null {
  try {
    const config = JSON.parse(jsonString) as AppConfig;
    // 基本验证
    if (!config.environments || !Array.isArray(config.environments)) {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

// 下载配置文件
export function downloadConfig(config: AppConfig): void {
  const json = exportConfig(config);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `env-switch-config-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 从文件读取配置
export function readConfigFromFile(file: File): Promise<AppConfig | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(importConfig(content));
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
