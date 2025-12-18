import { useEffect, useRef, useState } from "react";
import {
  addEnv,
  deleteEnv,
  generateId,
  isCurrentDomainAllowed,
  loadConfig,
  savePanelPosition,
  setCurrentEnv,
  updateEnv,
} from "@/storage";
import type { AppConfig, EnvConfig, FieldConfig, PanelPosition } from "@/types";
import { checkAndFillPending, switchEnvironment } from "../switcher";
import { startSelecting, stopSelecting } from "../selector";
import "./App.css";

type EditableEnv = Omit<EnvConfig, "id"> & { id?: string };
type SelectState = { mode: "field" | "loginButton"; fieldId?: string } | null;

const createDefaultFields = (): FieldConfig[] => [
  { id: generateId(), label: "用户名", selector: "", value: "" },
  { id: generateId(), label: "密码", selector: "", value: "" },
];

function App() {
  const [config, setConfig] = useState<AppConfig>({ environments: [] });
  const [panelOpen, setPanelOpen] = useState(true);
  const [editingEnv, setEditingEnv] = useState<EditableEnv | null>(null);
  const [selectState, setSelectState] = useState<SelectState>(null);
  const [saving, setSaving] = useState(false);
  const [panelPosition, setPanelPositionState] = useState<PanelPosition | null>(
    null
  );
  const [isDomainAllowed, setIsDomainAllowed] = useState(true);

  const positionRef = useRef<PanelPosition | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    const init = async () => {
      const cfg = await loadConfig();
      applyPanelPosition(cfg.panelPosition ?? null);
      setConfig(cfg);

      // 检查当前域名是否允许
      const allowed = isCurrentDomainAllowed(cfg.allowedDomains);
      setIsDomainAllowed(allowed);

      // 只有在允许的域名下才执行自动填充
      if (allowed) {
        await checkAndFillPending();
      }
    };
    void init();
  }, []);

  useEffect(() => {
    if (!selectState) {
      stopSelecting();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectState(null);
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selectState]);

  useEffect(() => () => stopSelecting(), []);

  const applyPanelPosition = (pos: PanelPosition | null) => {
    positionRef.current = pos;
    setPanelPositionState(pos);
  };

  const panelStyle: React.CSSProperties = panelPosition
    ? { top: panelPosition.y, left: panelPosition.x }
    : { top: 120, right: 20 };

  const refreshConfig = async () => {
    const next = await loadConfig();
    setConfig(next);
    applyPanelPosition(next.panelPosition ?? null);
  };

  // 面板头部拖动
  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.addEventListener("mousemove", handleDragging);
    document.addEventListener("mouseup", handleDragEnd);
  };

  const handleDragging = (e: MouseEvent) => {
    isDragging.current = true;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const clampedX = Math.min(Math.max(8, x), window.innerWidth - 60);
    const clampedY = Math.min(Math.max(8, y), window.innerHeight - 60);
    applyPanelPosition({ x: clampedX, y: clampedY });
  };

  const handleDragEnd = () => {
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", handleDragEnd);
    const latest = positionRef.current;
    if (latest) {
      void savePanelPosition(latest.x, latest.y);
    }
    // 延迟重置拖动状态，避免触发点击
    setTimeout(() => {
      isDragging.current = false;
    }, 50);
  };

  // 圆球按钮拖动
  const handleToggleBtnDragStart = (e: React.MouseEvent) => {
    if (!toggleBtnRef.current) return;
    const rect = toggleBtnRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    isDragging.current = false;
    document.addEventListener("mousemove", handleDragging);
    document.addEventListener("mouseup", handleDragEnd);
  };

  const handleToggleBtnClick = () => {
    // 只有在没有拖动时才展开面板
    if (!isDragging.current) {
      setPanelOpen(true);
    }
  };

  const startCreateEnv = () => {
    setEditingEnv({
      name: "",
      loginUrl: "",
      fields: createDefaultFields(),
      loginButtonSelector: "",
    });
  };

  const startEditEnv = (env: EnvConfig) => {
    setEditingEnv({
      ...env,
      loginButtonSelector: env.loginButtonSelector ?? "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEnv(null);
    setSelectState(null);
  };

  const updateEditingField = (
    fieldId: string,
    partial: Partial<FieldConfig>
  ) => {
    setEditingEnv((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map((field) =>
          field.id === fieldId ? { ...field, ...partial } : field
        ),
      };
    });
  };

  const handleSelectField = (fieldId: string) => {
    console.log("[App] handleSelectField 被调用, fieldId:", fieldId);
    setSelectState({ mode: "field", fieldId });
    startSelecting((selector) => {
      console.log(
        "[App] 收到选择器回调, selector:",
        selector,
        "fieldId:",
        fieldId
      );
      updateEditingField(fieldId, { selector });
      setSelectState(null);
    });
  };

  const handleSelectLoginButton = () => {
    console.log("[App] handleSelectLoginButton 被调用");
    setSelectState({ mode: "loginButton" });
    startSelecting((selector) => {
      console.log("[App] 收到登录按钮选择器回调, selector:", selector);
      setEditingEnv((prev) =>
        prev ? { ...prev, loginButtonSelector: selector } : prev
      );
      setSelectState(null);
    });
  };

  const handleAddField = () => {
    setEditingEnv((prev) =>
      prev
        ? {
            ...prev,
            fields: [
              ...prev.fields,
              { id: generateId(), label: "新字段", selector: "", value: "" },
            ],
          }
        : prev
    );
  };

  const handleRemoveField = (fieldId: string) => {
    setEditingEnv((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.filter((field) => field.id !== fieldId),
          }
        : prev
    );
  };

  const handleSaveEnv = async () => {
    if (!editingEnv) return;
    if (!editingEnv.name.trim() || !editingEnv.loginUrl.trim()) {
      window.alert("请填写环境名称和登录页地址（必填）");
      return;
    }

    setSaving(true);
    const normalizedFields = editingEnv.fields.map((field) => ({
      ...field,
      label: field.label.trim() || "未命名字段",
      selector: field.selector.trim(),
    }));

    const payload: EnvConfig = {
      id: editingEnv.id ?? generateId(),
      name: editingEnv.name.trim(),
      loginUrl: editingEnv.loginUrl.trim(),
      fields: normalizedFields,
      loginButtonSelector: editingEnv.loginButtonSelector?.trim()
        ? editingEnv.loginButtonSelector.trim()
        : undefined,
    };

    try {
      if (editingEnv.id) {
        await updateEnv(payload);
      } else {
        await addEnv({
          name: payload.name,
          loginUrl: payload.loginUrl,
          fields: payload.fields,
          loginButtonSelector: payload.loginButtonSelector,
        });
      }
      await refreshConfig();
      setEditingEnv(null);
    } finally {
      setSaving(false);
      setSelectState(null);
    }
  };

  const handleDeleteEnv = async (envId: string) => {
    if (!window.confirm("确定删除该环境吗？")) return;
    await deleteEnv(envId);
    if (config.currentEnvId === envId) {
      await setCurrentEnv(undefined);
    }
    if (editingEnv?.id === envId) {
      setEditingEnv(null);
    }
    await refreshConfig();
  };

  const handleSwitchEnv = async (envId: string) => {
    const env = config.environments.find((item) => item.id === envId);
    if (!env) return;
    if (!env.loginUrl) {
      window.alert("请先为该环境填写登录页地址");
      return;
    }
    await setCurrentEnv(envId);
    setConfig((prev) => ({ ...prev, currentEnvId: envId }));
    switchEnvironment(env);
  };

  const renderFieldRows = () =>
    editingEnv?.fields.map((field) => (
      <div className="env-field-row" key={field.id}>
        <div className="env-form-group">
          <label className="env-form-label" htmlFor={`label-${field.id}`}>
            字段名称
          </label>
          <input
            id={`label-${field.id}`}
            className="env-form-input"
            value={field.label}
            onChange={(e) =>
              updateEditingField(field.id, { label: e.target.value })
            }
            placeholder="用户名/密码/验证码等"
          />
        </div>
        <div className="env-form-group">
          <label className="env-form-label" htmlFor={`selector-${field.id}`}>
            选择器
          </label>
          <input
            id={`selector-${field.id}`}
            className="env-form-input"
            value={field.selector}
            onChange={(e) =>
              updateEditingField(field.id, { selector: e.target.value })
            }
            placeholder="点击右侧按钮在页面上选取"
          />
        </div>
        <div className="env-form-group">
          <label className="env-form-label" htmlFor={`value-${field.id}`}>
            填充值
          </label>
          <input
            id={`value-${field.id}`}
            className="env-form-input"
            value={field.value}
            onChange={(e) =>
              updateEditingField(field.id, { value: e.target.value })
            }
            placeholder="用于自动填入的值"
          />
        </div>
        <button
          type="button"
          className={`env-select-btn ${
            selectState?.fieldId === field.id && selectState.mode === "field"
              ? "active"
              : ""
          }`}
          onClick={() => handleSelectField(field.id)}
          title="点击后到页面选取输入框"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 2L15 9H22L16.5 13L18.5 20L12 15.5L5.5 20L7.5 13L2 9H9L12 2Z" />
          </svg>
        </button>
        <button
          type="button"
          className="env-delete-field-btn"
          onClick={() => handleRemoveField(field.id)}
          title="删除字段"
        >
          <svg viewBox="0 0 24 24">
            <path d="M19 6H5V7H6V19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H19V6ZM9 8H11V19H9V8ZM13 8H15V19H13V8ZM15.5 4L14.5 3H9.5L8.5 4H5V5H19V4H15.5Z" />
          </svg>
        </button>
      </div>
    ));

  const renderEnvList = () => {
    if (config.environments.length === 0) {
      return (
        <div className="env-empty-state">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L3 7V17L12 22L21 17V7L12 2ZM12 4.18L18.5 7.5L12 10.82L5.5 7.5L12 4.18ZM5 9.1L11 12.39V18.91L5 15.63V9.1ZM13 18.91V12.39L19 9.1V15.63L13 18.91Z" />
          </svg>
          <div>暂未创建环境，点击下方添加按钮开始配置</div>
        </div>
      );
    }

    return config.environments.map((env) => (
      <div
        key={env.id}
        className={`env-item ${config.currentEnvId === env.id ? "active" : ""}`}
        onClick={() => handleSwitchEnv(env.id)}
      >
        <div>
          <div className="env-item-name">{env.name}</div>
          <div className="env-item-url">{env.loginUrl}</div>
        </div>
        <div className="env-item-actions">
          <button
            type="button"
            className="env-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              startEditEnv(env);
            }}
            title="编辑环境"
          >
            <svg viewBox="0 0 24 24">
              <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM21.71 6.04C22.1 5.65 22.1 5.02 21.71 4.63L19.37 2.29C18.98 1.9 18.35 1.9 17.96 2.29L16.13 4.12L19.88 7.87L21.71 6.04Z" />
            </svg>
          </button>
          <button
            type="button"
            className="env-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteEnv(env.id);
            }}
            title="删除环境"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 7H5V6H9V5H15V6H19V7H18V19C18 20.1 17.1 21 16 21H8C6.9 21 6 20.1 6 19V7ZM8 19H16V7H8V19ZM10 9H11V17H10V9ZM13 9H14V17H13V9Z" />
            </svg>
          </button>
        </div>
      </div>
    ));
  };

  const renderEditor = () => (
    <div className="env-edit-form">
      <div className="env-form-group">
        <label className="env-form-label required" htmlFor="env-name">
          环境名称
        </label>
        <input
          id="env-name"
          className="env-form-input"
          value={editingEnv?.name ?? ""}
          onChange={(e) =>
            setEditingEnv((prev) =>
              prev ? { ...prev, name: e.target.value } : prev
            )
          }
          placeholder="示例：开发环境 / 测试环境"
        />
      </div>
      <div className="env-form-group">
        <label className="env-form-label required" htmlFor="env-login-url">
          登录页地址
        </label>
        <input
          id="env-login-url"
          className="env-form-input"
          value={editingEnv?.loginUrl ?? ""}
          onChange={(e) =>
            setEditingEnv((prev) =>
              prev ? { ...prev, loginUrl: e.target.value } : prev
            )
          }
          placeholder="必填：切换时跳转到的登录页面"
        />
      </div>

      <div className="env-form-label" style={{ marginBottom: 8 }}>
        登录字段
      </div>
      {renderFieldRows()}
      <button
        type="button"
        className="env-add-field-btn"
        onClick={handleAddField}
      >
        + 添加字段
      </button>

      <div className="env-form-group">
        <label className="env-form-label" htmlFor="login-button-selector">
          登录按钮（可选）
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="login-button-selector"
            className="env-form-input"
            value={editingEnv?.loginButtonSelector ?? ""}
            onChange={(e) =>
              setEditingEnv((prev) =>
                prev ? { ...prev, loginButtonSelector: e.target.value } : prev
              )
            }
            placeholder="点击右侧按钮选取登录按钮"
          />
          <button
            type="button"
            className={`env-select-btn ${
              selectState?.mode === "loginButton" ? "active" : ""
            }`}
            onClick={handleSelectLoginButton}
            title="在页面上选取登录按钮"
          >
            <svg viewBox="0 0 24 24">
              <path d="M11 7L9.6 8.4L12.2 11H2V13H12.2L9.6 15.6L11 17L16 12L11 7ZM20 19H12V21H20C21.1 21 22 20.1 22 19V5C22 3.9 21.1 3 20 3H12V5H20V19Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="env-form-actions">
        <button
          type="button"
          className="env-btn env-btn-secondary"
          onClick={handleCancelEdit}
        >
          取消
        </button>
        {editingEnv?.id ? (
          <button
            type="button"
            className="env-btn env-btn-danger"
            onClick={() =>
              editingEnv?.id && void handleDeleteEnv(editingEnv.id)
            }
          >
            删除
          </button>
        ) : null}
        <button
          type="button"
          className="env-btn env-btn-primary"
          onClick={handleSaveEnv}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存环境"}
        </button>
      </div>
    </div>
  );

  // 如果当前域名不在允许列表中，不显示面板
  if (!isDomainAllowed) {
    return null;
  }

  return (
    <>
      {selectState ? (
        <div className="env-select-mode-hint">
          {selectState.mode === "field"
            ? "请点击需要自动填写的输入框（Esc 取消）"
            : "请点击登录按钮（Esc 取消）"}
        </div>
      ) : null}

      <div className="env-panel" style={panelStyle}>
        {panelOpen ? (
          <div className="env-main-panel" ref={panelRef}>
            <div className="env-panel-header" onMouseDown={handleDragStart}>
              <h3>环境切换</h3>
              <div className="env-panel-header-actions">
                <button
                  type="button"
                  className="env-icon-btn"
                  onClick={() => setPanelOpen(false)}
                  title="收起面板"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M6 19L8.1 21.1L15.2 14L8.1 6.9L6 9L11 14L6 19ZM14 19L16.1 21.1L23.2 14L16.1 6.9L14 9L19 14L14 19Z" />
                  </svg>
                </button>
              </div>
            </div>

            {editingEnv ? (
              renderEditor()
            ) : (
              <>
                <div className="env-list">{renderEnvList()}</div>
                <button
                  type="button"
                  className="env-add-btn"
                  onClick={startCreateEnv}
                >
                  + 新建环境
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            ref={toggleBtnRef}
            type="button"
            className="env-toggle-btn"
            onMouseDown={handleToggleBtnDragStart}
            onClick={handleToggleBtnClick}
            title="展开环境切换面板（可拖动）"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 2L3 7V17L12 22L21 17V7L12 2ZM12 4.18L18.5 7.5L12 10.82L5.5 7.5L12 4.18ZM5 9.1L11 12.39V18.91L5 15.63V9.1ZM13 18.91V12.39L19 9.1V15.63L13 18.91Z" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}

export default App;
