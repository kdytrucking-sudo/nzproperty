'use client';

import {
  FileJson,
  LayoutDashboard,
  Settings,
  FileText,
  FileUp,
  MessageSquareQuote,
  ListTodo,
  Image,
  FlaskConical,
  Smartphone,
  History,
  Pencil,
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

export function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: '/',
      label: 'Generate Report',
      icon: LayoutDashboard,
    },
     {
      href: '/advanced-image-test',
      label: 'Image Replace',
      icon: Image,
    },
     {
      href: '/image-test',
      label: 'Test ImageUpload',
      icon: FlaskConical,
    },
    {
      href: '/inspection',
      label: 'Inspection',
      icon: Smartphone,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
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
                isActive={pathname === item.href || (item.href === '/inspection' && pathname.startsWith('/inspection/')) || (item.href === '/settings' && pathname.startsWith('/settings'))}
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
