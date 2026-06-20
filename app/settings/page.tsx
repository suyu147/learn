'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/lib/store/settings';
import { Key, Palette, ImageIcon, Eye, EyeOff, Check, Loader2, BookOpen, Cpu, Download, Upload, Sparkles, Network, Users } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { IMAGE_GEN_PROVIDERS, type ImageGenProvider } from '@/lib/generation/image-generator';
import { SPARK_MODELS } from '@/lib/ai/spark-adapter';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { ArchitectureOverview } from '@/components/architecture-overview';
import { AgentRolesCard } from '@/components/agent-roles-card';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { useResourcesStore } from '@/lib/store/resources';
import { useLearningPathStore } from '@/lib/store/learning-path';
import { useResourceDecisionsStore } from '@/lib/store/resource-decisions';
import { useAgentActivityStore } from '@/lib/store/agent-activity';

export default function SettingsPage() {
  const {
    providerId,
    modelId,
    apiKey,
    apiSecret,
    baseUrl,
    theme,
    language,
    generatePptImages,
    setProviderId,
    setModelId,
    setApiKey,
    setApiSecret,
    setBaseUrl,
    setTheme,
    setLanguage,
    setGeneratePptImages,
    sparkApiKey,
    sparkApiSecret,
    sparkModelId,
    disabledAgentIds,
    setSparkApiKey,
    setSparkApiSecret,
    setSparkModelId,
    setDisabledAgentIds,
  } = useSettingsStore();

  const { t } = useI18n();

  const agents = useAgentRegistry((s) => s.agents);
  const resourceGenAgents = agents.filter((a) => a.taskTypes?.includes('resource_gen'));
  const importFileRef = useRef<HTMLInputElement>(null);

  const [showSparkApiKey, setShowSparkApiKey] = useState(false);
  const [showSparkApiSecret, setShowSparkApiSecret] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [imageGenProvider, setImageGenProvider] = useState<ImageGenProvider>('siliconflow');
  const [imageGenApiKey, setImageGenApiKey] = useState('');
  const [imageGenBaseUrl, setImageGenBaseUrl] = useState('');
  const [imageGenModel, setImageGenModel] = useState('');
  const [doubaoApiKey, setDoubaoApiKey] = useState('');
  const [doubaoBaseUrl, setDoubaoBaseUrl] = useState('');
  const [doubaoModel, setDoubaoModel] = useState('');
  const [showImageGenKey, setShowImageGenKey] = useState(false);
  const [showDoubaoKey, setShowDoubaoKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [maskedImageGenKey, setMaskedImageGenKey] = useState('');
  const [maskedDoubaoKey, setMaskedDoubaoKey] = useState('');

  useEffect(() => {
    fetch('/api/settings/image-gen')
      .then((r) => r.json())
      .then((data) => {
        const c = data.imageGenConfig;
        if (c) {
          setImageGenProvider((c.IMAGE_GEN_PROVIDER || 'siliconflow') as ImageGenProvider);
          setMaskedImageGenKey(c.IMAGE_GEN_API_KEY || '');
          setImageGenBaseUrl(c.IMAGE_GEN_BASE_URL || '');
          setImageGenModel(c.IMAGE_GEN_MODEL || '');
          setMaskedDoubaoKey(c.DOUBAO_IMAGE_API_KEY || '');
          setDoubaoBaseUrl(c.DOUBAO_IMAGE_BASE_URL || '');
          setDoubaoModel(c.DOUBAO_IMAGE_MODEL || '');
        }
      })
      .catch(() => {});
  }, []);

  const currentProviderConfig = IMAGE_GEN_PROVIDERS.find((p) => p.id === imageGenProvider);

  const handleSaveImageGen = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/settings/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageGenConfig: {
            IMAGE_GEN_PROVIDER: imageGenProvider,
            IMAGE_GEN_API_KEY: imageGenApiKey || undefined,
            IMAGE_GEN_BASE_URL: imageGenBaseUrl || undefined,
            IMAGE_GEN_MODEL: imageGenModel || undefined,
            DOUBAO_IMAGE_API_KEY: doubaoApiKey || undefined,
            DOUBAO_IMAGE_BASE_URL: doubaoBaseUrl || undefined,
            DOUBAO_IMAGE_MODEL: doubaoModel || undefined,
          },
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setImageGenApiKey('');
        setDoubaoApiKey('');
        setShowImageGenKey(false);
        setShowDoubaoKey(false);

        const data = await response.json();
        if (data.imageGenConfig) {
          setMaskedImageGenKey(data.imageGenConfig.IMAGE_GEN_API_KEY || '');
          setMaskedDoubaoKey(data.imageGenConfig.DOUBAO_IMAGE_API_KEY || '');
        }

        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  }, [imageGenProvider, imageGenApiKey, imageGenBaseUrl, imageGenModel, doubaoApiKey, doubaoBaseUrl, doubaoModel]);

  const handleExportData = useCallback(() => {
    const exportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      learningProfile: useLearningProfileStore.getState().profile,
      profileHistory: useLearningProfileStore.getState().profileHistory,
      resources: useResourcesStore.getState().storedResources,
      learningPath: useLearningPathStore.getState().storedPaths,
      resourceDecisions: {
        logsBySession: useResourceDecisionsStore.getState().logsBySession,
        overridesBySession: useResourceDecisionsStore.getState().overridesBySession,
        feedbackBySession: useResourceDecisionsStore.getState().feedbackBySession,
      },
      agentActivity: useAgentActivityStore.getState().activityLog,
      settings: {
        providerId: useSettingsStore.getState().providerId,
        modelId: useSettingsStore.getState().modelId,
        sparkModelId: useSettingsStore.getState().sparkModelId,
        theme: useSettingsStore.getState().theme,
        language: useSettingsStore.getState().language,
        disabledAgentIds: useSettingsStore.getState().disabledAgentIds,
      },
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartlearn-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportData = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version !== 1) {
        setImportStatus('不支持的导出格式');
        return;
      }
      if (data.learningProfile) {
        useLearningProfileStore.getState().setProfile(data.learningProfile);
      }
      if (data.resources) {
        const resourcesStore = useResourcesStore.getState();
        for (const [sessionId, resources] of Object.entries(data.resources as Record<string, unknown>)) {
          if (Array.isArray(resources)) {
            for (const res of resources) {
              resourcesStore.addResource(res);
            }
          }
          void sessionId;
        }
      }
      if (data.settings) {
        const settingsStore = useSettingsStore.getState();
        if (data.settings.providerId) settingsStore.setProviderId(data.settings.providerId);
        if (data.settings.modelId) settingsStore.setModelId(data.settings.modelId);
        if (data.settings.sparkModelId) settingsStore.setSparkModelId(data.settings.sparkModelId);
        if (data.settings.theme) settingsStore.setTheme(data.settings.theme);
        if (data.settings.language) settingsStore.setLanguage(data.settings.language);
        if (data.settings.disabledAgentIds) settingsStore.setDisabledAgentIds(data.settings.disabledAgentIds);
      }
      setImportStatus('导入成功');
      setTimeout(() => setImportStatus(''), 3000);
    } catch {
      setImportStatus('导入失败：文件格式错误');
      setTimeout(() => setImportStatus(''), 3000);
    }
  }, []);

  function handleAgentToggle(agentId: string, enabled: boolean) {
    const next = enabled
      ? disabledAgentIds.filter((id) => id !== agentId)
      : [...disabledAgentIds, agentId];
    setDisabledAgentIds(next);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold">SmartLearn</span>
          </Link>
          <Link href="/workspace">
            <Button variant="ghost" size="sm">学习工作台</Button>
          </Link>
        </div>
      </header>
      <div className="container max-w-2xl flex-1 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
          <p className="text-muted-foreground">{t('settingsPage.description')}</p>
        </div>

        <div className="space-y-6">
          {/* AI模型配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-4 w-4" />
                {t('settingsPage.aiModel.title')}
              </CardTitle>
              <CardDescription>{t('settingsPage.aiModel.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settingsPage.aiModel.provider')}</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spark">{t('settingsPage.providers.spark')}</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="kimi">Kimi</SelectItem>
                    <SelectItem value="qwen">{t('settingsPage.providers.qwen')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('settingsPage.aiModel.model')}</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerId === 'spark' && (
                      <>
                        <SelectItem value="lite">{t('settingsPage.models.sparkLite')}</SelectItem>
                        <SelectItem value="generalv3">{t('settingsPage.models.sparkPro')}</SelectItem>
                        <SelectItem value="pro-128k">{t('settingsPage.models.sparkPro128k')}</SelectItem>
                        <SelectItem value="4.0Ultra">{t('settingsPage.models.spark4Ultra')}</SelectItem>
                      </>
                    )}
                    {providerId === 'openai' && (
                      <>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                      </>
                    )}
                    {providerId === 'deepseek' && (
                      <>
                        <SelectItem value="deepseek-chat">DeepSeek-Chat</SelectItem>
                        <SelectItem value="deepseek-reasoner">DeepSeek-Reasoner</SelectItem>
                      </>
                    )}
                    {providerId === 'kimi' && (
                      <>
                        <SelectItem value="moonshot-v1-128k">Moonshot V1 128K</SelectItem>
                      </>
                    )}
                    {providerId === 'qwen' && (
                      <>
                        <SelectItem value="qwen3-max">Qwen3 Max</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('settingsPage.aiModel.apiKeyPlaceholder')}
                />
              </div>

              {providerId === 'spark' && (
                <div className="space-y-2">
                  <Label>API Secret</Label>
                  <Input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder={t('settingsPage.aiModel.apiSecretPlaceholder')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('settingsPage.aiModel.baseUrlLabel')}</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={t('settingsPage.aiModel.baseUrlPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          {/* 图片生成模型配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" />
                图片生成模型
              </CardTitle>
              <CardDescription>
                配置AI配图生成服务，用于在PPT课件中自动生成配图
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>默认生成 PPT 配图</Label>
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">生成图片并插入课件</p>
                    <p className="text-sm text-muted-foreground">
                      打开后，学习工作台和 PPT 页面在生成动态课件时都会尝试调用已配置的图片生成服务。
                    </p>
                  </div>
                  <Switch checked={generatePptImages} onCheckedChange={setGeneratePptImages} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>图片生成模型</Label>
                <Select value={imageGenProvider} onValueChange={(v) => setImageGenProvider(v as ImageGenProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_GEN_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 通用API Key（非豆包模型） */}
              {imageGenProvider !== 'doubao' && (
                <div className="space-y-2">
                  <Label>API Key {maskedImageGenKey && <span className="ml-1 text-xs text-muted-foreground">（已配置: {maskedImageGenKey}）</span>}</Label>
                  <div className="relative">
                    <Input
                      type={showImageGenKey ? 'text' : 'password'}
                      value={imageGenApiKey}
                      onChange={(e) => setImageGenApiKey(e.target.value)}
                      placeholder={maskedImageGenKey ? '输入新密钥以替换现有配置' : '输入API密钥'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImageGenKey(!showImageGenKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showImageGenKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* 豆包专用API Key */}
              {imageGenProvider === 'doubao' && (
                <div className="space-y-2">
                  <Label>豆包 API Key {maskedDoubaoKey && <span className="ml-1 text-xs text-muted-foreground">（已配置: {maskedDoubaoKey}）</span>}</Label>
                  <div className="relative">
                    <Input
                      type={showDoubaoKey ? 'text' : 'password'}
                      value={doubaoApiKey}
                      onChange={(e) => setDoubaoApiKey(e.target.value)}
                      placeholder={maskedDoubaoKey ? '输入新密钥以替换现有配置' : '输入豆包API密钥'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDoubaoKey(!showDoubaoKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showDoubaoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    在火山引擎控制台获取API密钥：https://console.volcengine.com/visual
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={imageGenProvider === 'doubao' ? doubaoBaseUrl : imageGenBaseUrl}
                  onChange={(e) => {
                    if (imageGenProvider === 'doubao') {
                      setDoubaoBaseUrl(e.target.value);
                    } else {
                      setImageGenBaseUrl(e.target.value);
                    }
                  }}
                  placeholder={currentProviderConfig?.defaultBaseUrl || ''}
                />
              </div>

              <div className="space-y-2">
                <Label>模型标识</Label>
                <Input
                  value={imageGenProvider === 'doubao' ? doubaoModel : imageGenModel}
                  onChange={(e) => {
                    if (imageGenProvider === 'doubao') {
                      setDoubaoModel(e.target.value);
                    } else {
                      setImageGenModel(e.target.value);
                    }
                  }}
                  placeholder={currentProviderConfig?.defaultModel || ''}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveImageGen}
                  disabled={isSaving}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存图片生成配置'
                  )}
                </Button>
                {saveSuccess && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    已保存
                  </span>
                )}
              </div>

              <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                <p>提示：也可直接编辑项目根目录的 <code className="rounded bg-muted px-1 py-0.5">.env</code> 文件配置以下变量：</p>
                <ul className="ml-2 list-inside list-disc space-y-0.5">
                  <li><code className="rounded bg-muted px-1 py-0.5">IMAGE_GEN_PROVIDER</code> — 图片生成服务商</li>
                  <li><code className="rounded bg-muted px-1 py-0.5">IMAGE_GEN_API_KEY</code> — 通用API密钥</li>
                  <li><code className="rounded bg-muted px-1 py-0.5">DOUBAO_IMAGE_API_KEY</code> — 豆包专用API密钥</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 外观配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" />
                {t('settingsPage.appearance.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settingsPage.appearance.theme')}</Label>
                <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t('settingsPage.appearance.themeSystem')}</SelectItem>
                    <SelectItem value="light">{t('settingsPage.appearance.themeLight')}</SelectItem>
                    <SelectItem value="dark">{t('settingsPage.appearance.themeDark')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('settingsPage.appearance.language')}</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as 'zh-CN' | 'en-US')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">{t('settingsPage.appearance.langZhCN')}</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 讯飞星火专用配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                讯飞星火配置
              </CardTitle>
              <CardDescription>
                讯飞星火大模型专用 API 密钥与模型选择，独立于通用 AI 模型配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showSparkApiKey ? 'text' : 'password'}
                    value={sparkApiKey}
                    onChange={(e) => setSparkApiKey(e.target.value)}
                    placeholder="输入讯飞星火 API Key"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSparkApiKey(!showSparkApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSparkApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Secret</Label>
                <div className="relative">
                  <Input
                    type={showSparkApiSecret ? 'text' : 'password'}
                    value={sparkApiSecret}
                    onChange={(e) => setSparkApiSecret(e.target.value)}
                    placeholder="输入讯飞星火 API Secret"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSparkApiSecret(!showSparkApiSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSparkApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>星火模型</Label>
                <Select value={sparkModelId} onValueChange={setSparkModelId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPARK_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({(model.contextWindow / 1000).toFixed(0)}K 上下文)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                <p>在讯飞开放平台获取 API 密钥：https://www.xfyun.cn</p>
              </div>
            </CardContent>
          </Card>

          {/* 多 Agent 开关管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" />
                资源生成 Agent 管理
              </CardTitle>
              <CardDescription>
                开启或关闭各资源生成 Agent，关闭后对应类型的资源将不再自动生成
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {resourceGenAgents.map((agent) => {
                const isDisabled = disabledAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                    </div>
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={(checked) => handleAgentToggle(agent.id, checked)}
                    />
                  </div>
                );
              })}
              {resourceGenAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无可配置的资源生成 Agent</p>
              )}
            </CardContent>
          </Card>

          {/* 数据导出/导入 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4" />
                数据导出与导入
              </CardTitle>
              <CardDescription>
                导出学习画像、资源、路径等数据为 JSON 文件，或在另一设备导入恢复
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  导出数据
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportData(file);
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" onClick={() => importFileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  导入数据
                </Button>
              </div>
              {importStatus && (
                <p className={`text-sm ${importStatus.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
                  {importStatus}
                </p>
              )}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>导出内容包含：学习画像、学习路径、生成资源、决策日志、Agent 活动记录和应用设置</p>
                <p>注意：API 密钥不会包含在导出数据中</p>
              </div>
            </CardContent>
          </Card>

          {/* Agent 角色一览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Agent 角色一览
              </CardTitle>
              <CardDescription>
                悬停卡片可查看 System Prompt 摘要和任务类型
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentRolesCard />
            </CardContent>
          </Card>

          {/* 系统架构 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                系统架构
              </CardTitle>
              <CardDescription>
                SmartLearn 多层架构总览：从用户浏览器到大模型调用
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArchitectureOverview />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
