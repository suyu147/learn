'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, BookOpen } from 'lucide-react';

export default function HomePage() {

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="space-y-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <BookOpen className="h-12 w-12 text-primary" />
          <div className="text-left">
            <h1 className="text-4xl font-bold">SmartLearn</h1>
            <Badge variant="secondary">第十五届中国软件杯 A3 赛题</Badge>
          </div>
        </div>

        <p className="max-w-md text-lg text-muted-foreground">
          基于大模型的个性化资源生成与学习多智能体系统
        </p>

        <div className="flex gap-4">
          <Link href="/profile">
            <Button size="lg" className="gap-2">
              <MessageSquare className="h-5 w-5" />
              开始构建学习画像
            </Button>
          </Link>
          <Link href="/workspace">
            <Button size="lg" variant="outline" className="gap-2">
              学习工作台
            </Button>
          </Link>
        </div>

        <div className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground underline underline-offset-4">
            设置
          </Link>
          <Link href="/ppt" className="hover:text-foreground underline underline-offset-4">
            动态课件
          </Link>
        </div>
      </div>
    </div>
  );
}