import { type ComponentType } from 'react'
import {
  CreditCard01,
  MarkerPin02,
  MessageChatCircle,
  Package,
  User01,
} from '@untitledui/icons'

export type Tab = 'reply' | 'products' | 'delivery' | 'payment' | 'profile'

export interface DashboardNavItem {
  key: Tab
  label: string
  note: string
  icon: ComponentType<{ className?: string }>
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    key: 'reply',
    label: 'Reply',
    note: 'Generate smart response suggestions',
    icon: MessageChatCircle,
  },
  {
    key: 'products',
    label: 'Products',
    note: 'Manage catalog and variants',
    icon: Package,
  },
  {
    key: 'delivery',
    label: 'Delivery',
    note: 'Configure zones and COD rules',
    icon: MarkerPin02,
  },
  {
    key: 'payment',
    label: 'Payment',
    note: 'Upgrade plan and billing',
    icon: CreditCard01,
  },
  {
    key: 'profile',
    label: 'Profile',
    note: 'Account details and usage',
    icon: User01,
  },
]

export const tabHeadings: Record<Tab, { title: string; description: string }> = {
  reply: {
    title: 'AI Reply Workspace',
    description: 'Paste customer chats and get polished, context-aware replies in seconds.',
  },
  products: {
    title: 'Product Catalog',
    description: 'Keep products and variants updated so replies stay accurate.',
  },
  delivery: {
    title: 'Delivery Settings',
    description: 'Set up delivery zones and COD options for cleaner operations.',
  },
  payment: {
    title: 'Billing & Plan',
    description: 'Manage your subscription and unlock unlimited usage.',
  },
  profile: {
    title: 'Profile',
    description: 'Manage your account details, plan usage, and actions.',
  },
}
