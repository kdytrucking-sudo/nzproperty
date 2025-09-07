'use client';

import {
  FileJson,
  LayoutDashboard,
  ListTodo,
  PanelLeft,
  Settings,
  Pencil,
  FileText,
  FileUp,
  MessageSquareQuote,
  Construction,
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
} from '@/components/ui/sidebar';
import { Button } from './ui/button';

export function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: '/',
      label: 'Generate Report',
      icon: LayoutDashboard,
    },
    {
      href: '/manage-content',
      label: 'Manage Content',
      icon: Pencil,
    },
     {
      href: '/manage-commentary',
      label: 'Manage Commentary',
      icon: MessageSquareQuote,
    },
    {
      href: '/manage-templates',
      label: 'Manage Templates',
      icon: FileText,
    },
     {
      href: '/manage-multi-option',
      label: 'Manage Multi Options',
      icon: ListTodo,
    },
    {
      href: '/json-editor',
      label: 'AI Settings',
      icon: FileJson,
    },
  ];

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
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
