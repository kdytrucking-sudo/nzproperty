'use client';

import {
  FileJson,
  LayoutDashboard,
  PanelLeft,
  Settings,
  Pencil,
  FileText,
  FileUp,
  MessageSquareQuote,
  Construction,
  ListTodo,
  TestTube2,
  Image,
  FlaskConical,
  Smartphone,
  Package,
  History,
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
  SidebarGroupLabel,
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
      href: '/inspection',
      label: 'Field Inspection',
      icon: Smartphone,
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
      href: '/manage-multi-option',
      label: 'Multi-Select',
      icon: ListTodo,
    },
    {
      href: '/manage-templates',
      label: 'Manage Templates',
      icon: FileText,
    },
    {
      href: '/manage-images',
      label: 'Manage Images',
      icon: Image,
    },
    {
      href: '/manage-history',
      label: 'Manage History',
      icon: History,
    },
    {
      href: '/json-editor',
      label: 'AI Settings',
      icon: FileJson,
    },
  ];

  const testMenuItems = [
     {
      href: '/image-test',
      label: 'Image Upload',
      icon: TestTube2,
    },
     {
      href: '/advanced-image-test',
      label: 'Advanced Image Upload',
      icon: FlaskConical,
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
                isActive={pathname === item.href || (item.href === '/inspection' && pathname.startsWith('/inspection/'))}
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
           <SidebarGroupLabel>Test Center</SidebarGroupLabel>
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
