/**
 * 元素选择器模块
 * 实现点击选择页面元素并生成 CSS 选择器
 */

type SelectionCallback = (selector: string) => void;

// 高亮样式
const HIGHLIGHT_STYLE = {
  outline: "2px solid #3b82f6",
  outlineOffset: "2px",
  backgroundColor: "rgba(59, 130, 246, 0.1)",
};

// 保存原始样式
const originalStyles = new WeakMap<
  Element,
  {
    outline: string;
    outlineOffset: string;
    backgroundColor: string;
  }
>();

let isSelecting = false;
let currentHighlighted: Element | null = null;
let onSelectCallback: SelectionCallback | null = null;

// 鼠标移动处理
function handleMouseMove(e: MouseEvent) {
  const target = e.target as Element;

  // 忽略我们自己的 UI 元素
  if (target.closest("#crxjs-app")) {
    return;
  }

  // 移除之前的高亮
  if (currentHighlighted && currentHighlighted !== target) {
    removeHighlight(currentHighlighted);
  }

  // 高亮当前元素
  if (target !== currentHighlighted) {
    addHighlight(target);
    currentHighlighted = target;
  }
}

// 点击处理
function handleClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  const target = e.target as Element;

  console.log("[selector] 点击事件触发", {
    target,
    tagName: target.tagName,
    id: target.id,
    className: target.className,
    name: target.getAttribute("name"),
  });

  // 忽略我们自己的 UI 元素
  if (target.closest("#crxjs-app")) {
    console.log("[selector] 忽略: 点击了扩展自身的 UI 元素");
    return;
  }

  // 生成选择器
  const selector = generateSelector(target);
  console.log("[selector] 生成的选择器:", selector);

  // 先保存回调引用（因为 stopSelecting 会清空它）
  const callback = onSelectCallback;

  // 停止选择模式
  stopSelecting();

  // 调用回调
  if (callback) {
    console.log("[selector] 调用回调函数，传入选择器:", selector);
    callback(selector);
  } else {
    console.warn("[selector] 警告: callback 为 null，无法回调");
  }
}

// 添加高亮
function addHighlight(el: Element) {
  const htmlEl = el as HTMLElement;

  // 保存原始样式
  originalStyles.set(el, {
    outline: htmlEl.style.outline,
    outlineOffset: htmlEl.style.outlineOffset,
    backgroundColor: htmlEl.style.backgroundColor,
  });

  // 应用高亮样式
  htmlEl.style.outline = HIGHLIGHT_STYLE.outline;
  htmlEl.style.outlineOffset = HIGHLIGHT_STYLE.outlineOffset;
  htmlEl.style.backgroundColor = HIGHLIGHT_STYLE.backgroundColor;
}

// 移除高亮
function removeHighlight(el: Element) {
  const htmlEl = el as HTMLElement;
  const original = originalStyles.get(el);

  if (original) {
    htmlEl.style.outline = original.outline;
    htmlEl.style.outlineOffset = original.outlineOffset;
    htmlEl.style.backgroundColor = original.backgroundColor;
    originalStyles.delete(el);
  }
}

// 需要过滤的不稳定类名模式
const UNSTABLE_CLASS_PATTERNS = [
  /^css-/, // Ant Design 动态样式类
  /^sc-/, // styled-components
  /^emotion-/, // Emotion CSS
  /^_[a-zA-Z0-9]+$/, // CSS Modules 生成的类名
];

// 检查类名是否稳定
function isStableClass(className: string): boolean {
  return !UNSTABLE_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

// 生成 CSS 选择器
function generateSelector(el: Element): string {
  // 如果元素不是 input/textarea，优先尝试查找其内部的 input
  if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") {
    const innerInput = el.querySelector("input, textarea");
    if (innerInput) {
      console.log(
        "[selector] 检测到选择的是包装元素，优先为内部 input 生成选择器"
      );
      const innerSelector = generateSelectorForElement(innerInput);
      if (innerSelector) {
        return innerSelector;
      }
    }
  }

  return generateSelectorForElement(el);
}

// 为指定元素生成选择器
function generateSelectorForElement(el: Element): string {
  // 优先使用 ID
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  // 尝试使用 name 属性（适用于表单元素）
  const name = el.getAttribute("name");
  if (name) {
    const tagName = el.tagName.toLowerCase();
    const selector = `${tagName}[name="${CSS.escape(name)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 尝试使用唯一的 class 组合（过滤不稳定类名）
  if (el.classList.length > 0) {
    const stableClasses = Array.from(el.classList).filter(isStableClass);
    if (stableClasses.length > 0) {
      const classes = stableClasses.map((c) => `.${CSS.escape(c)}`).join("");
      const tagName = el.tagName.toLowerCase();
      const selector = `${tagName}${classes}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  // 尝试使用 placeholder 属性
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) {
    const tagName = el.tagName.toLowerCase();
    const selector = `${tagName}[placeholder="${CSS.escape(placeholder)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 尝试使用 type 属性（适用于 input）
  const type = el.getAttribute("type");
  if (type) {
    const tagName = el.tagName.toLowerCase();
    const selector = `${tagName}[type="${CSS.escape(type)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // 使用完整路径
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    // 添加 nth-child
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      if (siblings.filter((s) => s.tagName === current!.tagName).length > 1) {
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

// 键盘处理（ESC 取消）
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    stopSelecting();
  }
}

// 开始选择模式
export function startSelecting(callback: SelectionCallback): void {
  console.log("[selector] startSelecting 被调用");

  if (isSelecting) {
    console.log("[selector] 已在选择模式中，先停止再重新开始");
    stopSelecting();
  }

  isSelecting = true;
  onSelectCallback = callback;

  // 添加事件监听
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown, true);

  // 改变鼠标样式
  document.body.style.cursor = "crosshair";

  console.log(
    "[selector] 选择模式已启动，isSelecting:",
    isSelecting,
    "callback 是否存在:",
    !!onSelectCallback
  );
}

// 停止选择模式
export function stopSelecting(): void {
  isSelecting = false;
  onSelectCallback = null;

  // 移除高亮
  if (currentHighlighted) {
    removeHighlight(currentHighlighted);
    currentHighlighted = null;
  }

  // 移除事件监听
  document.removeEventListener("mousemove", handleMouseMove, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeyDown, true);

  // 恢复鼠标样式
  document.body.style.cursor = "";
}

// 检查是否在选择模式
export function isInSelectMode(): boolean {
  return isSelecting;
}

// 测试选择器是否有效
export function testSelector(selector: string): boolean {
  try {
    const el = document.querySelector(selector);
    return el !== null;
  } catch {
    return false;
  }
}

// 高亮指定选择器的元素（预览）
export function highlightElement(selector: string): void {
  try {
    const el = document.querySelector(selector);
    if (el) {
      addHighlight(el);
      setTimeout(() => removeHighlight(el), 1500);
    }
  } catch {
    // 选择器无效
  }
}
