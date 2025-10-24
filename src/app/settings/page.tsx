'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUser(user);
      setIsLoading(false);
    };
    
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f0e0] via-[#ede8d0] to-[#e5e0c8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[#d8d3bd] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#6b6550]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f0e0] via-[#ede8d0] to-[#e5e0c8] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-32 h-32 border-2 border-[#d8d3bd] rounded-full opacity-20"></div>
      <div className="absolute bottom-32 left-16 w-24 h-24 border-2 border-[#d8d3bd] opacity-15 rotate-45"></div>

      {/* Header */}
      <div className="bg-white/30 backdrop-blur-sm border-b border-[#d8d3bd] shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d8d3bd] to-[#cac5af] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-[#f5f0e0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#3d3935]">Settings</h1>
              <p className="text-sm text-[#6b6550]">Manage your account</p>
            </div>
          </div>
          <a
            href="/chat"
            className="text-[#6b6550] hover:text-[#3d3935] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-6">
          {/* Account Information Card */}
          <div className="bg-white/50 backdrop-blur-lg rounded-2xl p-8 border border-[#d8d3bd] shadow-lg">
            <h2 className="text-2xl font-light text-[#3d3935] mb-6 flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              Account Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6b6550] mb-2">Email</label>
                <div className="px-4 py-3 bg-white/50 backdrop-blur border border-[#d8d3bd] rounded-xl text-[#3d3935]">
                  {user?.email}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#6b6550] mb-2">User ID</label>
                <div className="px-4 py-3 bg-white/50 backdrop-blur border border-[#d8d3bd] rounded-xl text-[#3d3935] font-mono text-sm break-all">
                  {user?.id}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#6b6550] mb-2">Account Created</label>
                <div className="px-4 py-3 bg-white/50 backdrop-blur border border-[#d8d3bd] rounded-xl text-[#3d3935]">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white/50 backdrop-blur-lg rounded-2xl p-8 border border-[#d8d3bd] shadow-lg">
            <h2 className="text-2xl font-light text-[#3d3935] mb-6 flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              Quick Actions
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/chat"
                className="p-4 bg-gradient-to-r from-[#d8d3bd] to-[#cac5af] hover:from-[#cac5af] hover:to-[#b8b39d] rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-3 text-[#3d3935]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <span className="font-medium">Go to Chat</span>
              </a>
              
              <button
                onClick={handleLogout}
                className="p-4 bg-white/50 backdrop-blur hover:bg-white/70 border border-[#d8d3bd] rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-3 text-[#3d3935]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>

          {/* About Card */}
          <div className="bg-white/50 backdrop-blur-lg rounded-2xl p-8 border border-[#d8d3bd] shadow-lg">
            <h2 className="text-2xl font-light text-[#3d3935] mb-6 flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              About
            </h2>
            
            <div className="space-y-3 text-[#6b6550]">
              <p className="flex items-center gap-2">
                <span className="font-medium text-[#3d3935]">Version:</span> 1.0.0
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium text-[#3d3935]">Platform:</span> RAG Knowledge Assistant
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium text-[#3d3935]">Status:</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                  Online
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Wave decoration at bottom */}
      <div className="absolute bottom-0 left-0 right-0 opacity-5 pointer-events-none">
        <svg viewBox="0 0 1200 120" className="w-full text-[#cac5af]">
          <path
            d="M0,50 C300,100 600,0 900,50 C1050,75 1125,50 1200,50 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}
