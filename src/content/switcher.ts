/**
 * 环境切换模块
 * 实现清空 localStorage、跳转页面、自动填充表单
 */

import type { EnvConfig, FieldConfig } from "../types";

// 等待元素出现
function waitForElement(
  selector: string,
  timeout = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    // 先检查元素是否已存在
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 超时处理
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// 填充单个字段
async function fillField(field: FieldConfig): Promise<boolean> {
  try {
    const el = await waitForElement(field.selector);
    if (!el) {
      console.warn(`[EnvSwitch] 未找到元素: ${field.selector}`);
      return false;
    }

    // 智能查找 input 元素
    // 如果选中的元素不是 input/textarea，则在其内部查找
    let input: HTMLInputElement | HTMLTextAreaElement | null = null;

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      input = el as HTMLInputElement | HTMLTextAreaElement;
    } else {
      // 在元素内部查找 input 或 textarea
      input = el.querySelector("input, textarea") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (input) {
        console.log(`[EnvSwitch] 在选中元素内部找到了 input 元素`);
      }
    }

    if (!input) {
      console.warn(
        `[EnvSwitch] 选中的元素不是输入框，也未在其内部找到输入框: ${field.selector}`
      );
      return false;
    }

    // 聚焦元素
    input.focus();

    // 设置值
    input.value = field.value;

    // 触发事件让 React/Vue 等框架识别值变化
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // 额外触发一些可能被框架监听的事件
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    console.log(`[EnvSwitch] 已填充字段: ${field.label}`);
    return true;
  } catch (error) {
    console.error(`[EnvSwitch] 填充字段失败: ${field.label}`, error);
    return false;
  }
}

// 填充所有字段
export async function fillAllFields(fields: FieldConfig[]): Promise<void> {
  for (const field of fields) {
    await fillField(field);
    // 字段间稍作延迟，避免填充过快
    await new Promise((r) => setTimeout(r, 100));
  }
}

// 清空 localStorage
export function clearLocalStorage(): void {
  try {
    localStorage.clear();
    console.log("[EnvSwitch] 已清空 localStorage");
  } catch (error) {
    console.error("[EnvSwitch] 清空 localStorage 失败", error);
  }
}

// 清空 sessionStorage
export function clearSessionStorage(): void {
  try {
    sessionStorage.clear();
    console.log("[EnvSwitch] 已清空 sessionStorage");
  } catch (error) {
    console.error("[EnvSwitch] 清空 sessionStorage 失败", error);
  }
}

// 切换环境
export function switchEnvironment(env: EnvConfig): void {
  // 保存待填充的配置到 sessionStorage（在清空之前）
  // 使用特殊的 key 避免被清空
  const fillData = JSON.stringify({
    envId: env.id,
    fields: env.fields,
    loginButtonSelector: env.loginButtonSelector,
    timestamp: Date.now(),
  });

  // 清空存储
  clearLocalStorage();
  clearSessionStorage();

  // 将填充数据保存到 chrome.storage（不会被页面清空）
  chrome.storage.local.set({ "env-switch-pending-fill": fillData });

  // 跳转到登录页
  window.location.href = env.loginUrl;
}

// 检查并执行待填充操作
export async function checkAndFillPending(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["env-switch-pending-fill"], async (result) => {
      const fillDataStr = result["env-switch-pending-fill"];

      if (typeof fillDataStr !== "string") {
        resolve();
        return;
      }

      try {
        const fillData = JSON.parse(fillDataStr) as {
          envId: string;
          fields: FieldConfig[];
          loginButtonSelector?: string;
          timestamp: number;
        };

        // 检查是否过期（10秒内有效）
        if (Date.now() - fillData.timestamp > 10000) {
          chrome.storage.local.remove(["env-switch-pending-fill"]);
          resolve();
          return;
        }

        console.log("[EnvSwitch] 检测到待填充数据，开始自动填充");

        // 等待页面加载完成
        await new Promise((r) => setTimeout(r, 500));

        // 填充表单
        await fillAllFields(fillData.fields);

        // 清除待填充数据
        chrome.storage.local.remove(["env-switch-pending-fill"]);

        console.log("[EnvSwitch] 自动填充完成");

        // 如果配置了登录按钮，自动点击
        if (fillData.loginButtonSelector) {
          console.log("[EnvSwitch] 准备点击登录按钮...");
          // 稍微延迟一下，确保表单已经准备好
          await new Promise((r) => setTimeout(r, 300));
          await clickLoginButton(fillData.loginButtonSelector);
        }
      } catch (error) {
        console.error("[EnvSwitch] 自动填充失败", error);
      }

      resolve();
    });
  });
}

// 点击登录按钮
export async function clickLoginButton(selector: string): Promise<boolean> {
  try {
    const el = await waitForElement(selector);
    if (!el) {
      console.warn("[EnvSwitch] 未找到登录按钮");
      return false;
    }

    (el as HTMLElement).click();
    console.log("[EnvSwitch] 已点击登录按钮");
    return true;
  } catch (error) {
    console.error("[EnvSwitch] 点击登录按钮失败", error);
    return false;
  }
}

// 执行退出登录（清除 localStorage 并刷新页面）
export function performLogout(): void {
  clearLocalStorage();
  clearSessionStorage();
  console.log("[EnvSwitch] 已执行退出登录，正在刷新页面...");
  window.location.reload();
}
