
'use client';

import {
  FileJson,
  LayoutDashboard,
  Settings,
  Pencil,
  FileText,
  FileUp,
  MessageSquareQuote,
  Construction,
  ListTodo,
  TestTube2,
  Image,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Logo } from '@/components/logo';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';

export function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: '/',
      label: '生成报告',
      icon: LayoutDashboard,
    },
    {
      href: '/manage-content',
      label: '管理内容',
      icon: Pencil,
    },
     {
      href: '/manage-commentary',
      label: '管理评论',
      icon: MessageSquareQuote,
    },
    {
      href: '/manage-multi-option',
      label: '管理选项',
      icon: ListTodo,
    },
    {
      href: '/manage-templates',
      label: '管理模板',
      icon: FileText,
    },
    {
      href: '/manage-images',
      label: '管理图片',
      icon: Image,
    },
    {
      href: '/json-editor',
      label: 'AI 设置',
      icon: FileJson,
    },
  ];

  const testMenuItems = [
     {
      href: '/image-test',
      label: '图片替换测试',
      icon: TestTube2,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex w-full items-center justify-between p-2">
          <Link href="/">
            <Logo />
          </Link>
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarSeparator />
           {testMenuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
