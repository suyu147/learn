'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProfileChat } from '@/components/profile/profile-chat';
import { ProfileCard } from '@/components/profile/profile-card';
import { useLearningProfileStore } from '@/lib/store/learning-profile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, User, BookOpen, Settings, Plus, History, Trash2, Clock, X } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { isProfileComplete } from '@/lib/utils/profile-utils';

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewChat = searchParams.get('new') === 'true';
  const {
    profile,
    archivedProfiles,
    isChatOpen,
    setChatOpen,
    archiveCurrentProfile,
    clearArchivedProfile,
    clearAllArchivedProfiles,
    reset,
  } = useLearningProfileStore();
  const { t } = useI18n();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // 单个删除目标ID
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // 画像已构建完成 → 自动跳转工作台（新建对话模式除外）
  useEffect(() => {
    if (!isNewChat && isProfileComplete(profile?.dimensions ?? null)) {
      router.replace('/workspace');
    }
  }, [profile?.id, profile?.updatedAt, router, isNewChat]);

  const archivedList = Object.values(archivedProfiles);

  function handleNewChat() {
    if (profile) {
      archiveCurrentProfile();
    }
    reset();
    setChatOpen(true);
  }

  function handleDeleteOne() {
    if (deleteTarget) {
      clearArchivedProfile(deleteTarget);
      setDeleteTarget(null);
    }
  }

  function handleDeleteAll() {
    clearAllArchivedProfiles();
    setDeleteAllConfirm(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold">SmartLearn</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/workspace">
              <Button variant="ghost" size="sm">学习工作台</Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <div className="container flex-1 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('profilePage.title')}</h1>
            <p className="text-muted-foreground">
              {t('profilePage.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 新建对话按钮 */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleNewChat}
              title="归档当前画像并开始新对话"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </Button>

            {/* 历史记录按钮 */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setHistoryOpen(true)}
              title="查看历史聊天记录"
            >
              <History className="h-4 w-4" />
              历史记录
              {archivedList.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                  {archivedList.length}
                </Badge>
              )}
            </Button>

            <Button onClick={() => setChatOpen(true)} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {profile ? t('profilePage.updateProfile') : t('profilePage.startBuild')}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isChatOpen ? (
              <ProfileChat />
            ) : (
              <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">{t('profilePage.notBuilt')}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('profilePage.notBuiltHint')}
                  </p>
                  <Button onClick={() => setChatOpen(true)} className="mt-4 gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t('profilePage.startChat')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div>
            <ProfileCard />
          </div>
        </div>
      </div>

      {/* 历史记录弹窗 */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              历史聊天记录
            </DialogTitle>
            <DialogDescription>
              查看和删除已归档的画像构建对话
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {archivedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Clock className="h-10 w-10 opacity-30" />
                <p className="mt-2 text-sm">暂无历史记录</p>
                <p className="text-xs">完成画像构建后，聊天记录会自动保存在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                {archivedList.map((archivedProfile) => (
                  <div
                    key={archivedProfile.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-medium truncate">
                        {archivedProfile.dimensions?.learningGoals?.shortTerm?.join('、')
                          || archivedProfile.dimensions?.learningGoals?.longTerm
                          || '画像记录'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        更新于 {new Date(archivedProfile.updatedAt).toLocaleString('zh-CN')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {archivedProfile.conversationHistory?.length || 0} 条对话
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(archivedProfile.id)}
                      title="删除此记录"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {archivedList.length > 0 && (
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteAllConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                清空全部
              </Button>
              <Button variant="outline" size="sm" onClick={() => setHistoryOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除单个记录确认弹窗 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除历史记录</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将彻底删除该聊天记录及其关联的画像数据，且不可恢复。确定要删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOne}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空全部确认弹窗 */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空全部历史记录</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将彻底删除全部 {archivedList.length} 条历史聊天记录及其关联的画像数据，且不可恢复。确定要清空全部吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认清空全部
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfilePageContent />
    </Suspense>
  );
}
