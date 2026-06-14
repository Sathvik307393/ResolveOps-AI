import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen text-slate-200">
      <Sidebar />
      <main className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
