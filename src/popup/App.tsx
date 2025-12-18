import { useEffect, useRef, useState } from "react";
import {
  loadConfig,
  saveConfig,
  downloadConfig,
  readConfigFromFile,
} from "@/storage";
import type { AppConfig } from "@/types";
import "./App.css";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const cfg = await loadConfig();
      setConfig(cfg);
      setDomainInput((cfg.allowedDomains ?? []).join("\n"));
    };
    void init();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const domains = domainInput
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    const newConfig = { ...config, allowedDomains: domains };
    await saveConfig(newConfig);
    setConfig(newConfig);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    if (!config) return;
    downloadConfig(config);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const importedConfig = await readConfigFromFile(file);
    if (importedConfig) {
      await saveConfig(importedConfig);
      setConfig(importedConfig);
      setDomainInput((importedConfig.allowedDomains ?? []).join("\n"));
      setImportStatus("success");

      // 自动刷新当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.reload(tabs[0].id);
        }
      });

      setTimeout(() => setImportStatus("idle"), 2000);
    } else {
      setImportStatus("error");
      setTimeout(() => setImportStatus("idle"), 2000);
    }

    // 重置 file input
    e.target.value = "";
  };

  return (
    <div className="popup-container">
      <h2>环境切换插件设置</h2>

      <div className="form-group">
        <label htmlFor="allowed-domains">允许显示的域名</label>
        <textarea
          id="allowed-domains"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder={
            "每行一个域名，例如：\nexample.com\n*.test.com\n\n留空表示在所有页面显示"
          }
          rows={5}
        />
        <div className="hint">
          支持通配符，如 <code>*.example.com</code> 匹配所有子域名
        </div>
      </div>

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : saved ? "✓ 已保存" : "保存设置"}
      </button>

      <div className="divider" />

      <div className="config-actions">
        <button className="action-btn" onClick={handleExport}>
          📤 导出配置
        </button>
        <button className="action-btn" onClick={handleImportClick}>
          📥 导入配置
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {importStatus === "success" && (
        <div className="status-msg success">✓ 配置导入成功</div>
      )}
      {importStatus === "error" && (
        <div className="status-msg error">✗ 配置文件格式错误</div>
      )}

      <div className="tip">配置后需要刷新页面才能生效</div>
    </div>
  );
}
