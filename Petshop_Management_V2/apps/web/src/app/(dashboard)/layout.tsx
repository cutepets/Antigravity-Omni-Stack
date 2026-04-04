import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { PageTransition } from '@/components/layout/page-transition'
import { GlobalKeyboardShortcuts } from '@/components/layout/global-keyboard-shortcuts'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-grid-pattern" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <GlobalKeyboardShortcuts />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 24px 24px',
            position: 'relative'
          }}
        >
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
