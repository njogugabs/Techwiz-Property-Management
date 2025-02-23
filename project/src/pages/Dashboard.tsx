import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Building,
  Users,
  Home,
  DollarSign,
  BarChart3,
  Droplets,
  Wallet,
  FileText,
  Percent,
  Settings,
  Mail,
  FileBarChart,
  LogOut,
  ChevronDown,
  Wrench,
  Bell,
  Database,
  MessageSquare,
  UserCog,
  ClipboardList,
  Layers,
  Plus
} from 'lucide-react';
import type { Profile } from '../lib/types';
import { AddPropertyForm } from '../components/AddPropertyForm';
import { AddUnitForm } from '../components/AddUnitForm';
import { AddTenantForm } from '../components/AddTenantForm';
import { AddUtilityForm } from '../components/AddUtilityForm';
import { AddDepositForm } from '../components/AddDepositForm';
import { CreateInvoiceForm } from '../components/CreateInvoiceForm';
import { AddTaxForm } from '../components/AddTaxForm';
import { MakePaymentForm } from '../components/MakePaymentForm';
import { TaxList } from './TaxList';
import { InvoiceList } from './InvoiceList';
import { PaymentList } from './PaymentList';
import { PropertyList } from './PropertyList';
import { UnitList } from './UnitList';

interface DashboardStats {
  totalProperties: number;
  totalTenants: number;
  occupancyRate: number;
  monthlyRevenue: number;
}

interface NavGroup {
  name: string;
  icon: React.ReactNode;
  items: {
    name: string;
    icon: React.ReactNode;
    path?: string;
    action?: () => void;
  }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddUtility, setShowAddUtility] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showAddTax, setShowAddTax] = useState(false);
  const [showMakePayment, setShowMakePayment] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalTenants: 0,
    occupancyRate: 0,
    monthlyRevenue: 0
  });

  const navigation: NavGroup[] = [
    {
      name: 'Financials',
      icon: <DollarSign className="h-5 w-5" />,
      items: [
        { name: 'Invoices', icon: <FileText className="h-4 w-4" />, path: 'invoices' },
        { name: 'Create Invoice', icon: <Plus className="h-4 w-4" />, action: () => setShowCreateInvoice(true) },
        { name: 'Payments', icon: <Wallet className="h-4 w-4" />, path: 'payments' },
        { name: 'Make Payment', icon: <Plus className="h-4 w-4" />, action: () => setShowMakePayment(true) },
        { name: 'Taxes', icon: <Percent className="h-4 w-4" />, path: 'taxes' },
        { name: 'Expenses', icon: <DollarSign className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Property/Unit',
      icon: <Building className="h-5 w-5" />,
      items: [
        { name: 'Properties', icon: <Home className="h-4 w-4" />, path: 'properties' },
        { name: 'Units', icon: <Building className="h-4 w-4" />, action: () => setShowAddUnit(true) },
        { name: 'Utilities', icon: <Droplets className="h-4 w-4" />, action: () => setShowAddUtility(true) },
        { name: 'Maintenance', icon: <Wrench className="h-4 w-4" /> },
        { name: 'Property Grouping', icon: <Layers className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Reports',
      icon: <FileBarChart className="h-5 w-5" />,
      items: [
        { name: 'Financial Reports', icon: <FileBarChart className="h-4 w-4" /> },
        { name: 'Occupancy Reports', icon: <Users className="h-4 w-4" /> },
        { name: 'Maintenance Reports', icon: <Wrench className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Communication',
      icon: <Mail className="h-5 w-5" />,
      items: [
        { name: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
        { name: 'Notifications', icon: <Bell className="h-4 w-4" /> }
      ]
    },
    {
      name: 'Settings',
      icon: <Settings className="h-5 w-5" />,
      items: [
        { name: 'General', icon: <Settings className="h-4 w-4" /> },
        { name: 'Backup', icon: <Database className="h-4 w-4" /> },
        { name: 'Alerts', icon: <Bell className="h-4 w-4" /> },
        { name: 'Account Info', icon: <UserCog className="h-4 w-4" /> },
        { name: 'Message Templates', icon: <MessageSquare className="h-4 w-4" /> },
        { name: 'Users', icon: <Users className="h-4 w-4" /> },
        { name: 'Billing', icon: <DollarSign className="h-4 w-4" /> },
        { name: 'Audit Trail', icon: <ClipboardList className="h-4 w-4" /> }
      ]
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(name => name !== groupName)
        : [...prev, groupName]
    );
  };

  const handleNavigation = (item: { path?: string; action?: () => void }) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.action) {
      item.action();
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Fetch all properties
      const { data: allProperties } = await supabase
        .from('properties')
        .select('*');

      // Fetch user's properties for specific stats
      const { data: userProperties } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user.id);

      // Fetch user's tenants
      const { data: userTenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('owner_id', user.id);

      const totalProperties = allProperties?.length || 0;
      const userPropertyCount = userProperties?.length || 0;
      const totalTenants = userTenants?.length || 0;
      const occupancyRate = userPropertyCount > 0 ? (totalTenants / userPropertyCount) * 100 : 0;
      
      // Calculate monthly revenue from user's active leases
      const { data: leases } = await supabase
        .from('leases')
        .select('monthly_rent')
        .eq('owner_id', user.id)
        .eq('status', 'active');

      const monthlyRevenue = leases?.reduce((sum, lease) => sum + (lease.monthly_rent || 0), 0) || 0;

      setProfile(profile);
      setStats({
        totalProperties,
        totalTenants,
        occupancyRate,
        monthlyRevenue
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login');
      } else {
        fetchDashboardData();
      }
    });

    // Initial data fetch
    fetchDashboardData();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold">Techwiz Property Management</h1>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">Welcome, {profile?.full_name}</span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="mt-5 px-2">
            {navigation.map((group) => (
              <div key={group.name} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
                >
                  {group.icon}
                  <span className="ml-3">{group.name}</span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 transform transition-transform ${
                      expandedGroups.includes(group.name) ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedGroups.includes(group.name) && (
                  <div className="space-y-1 pl-10">
                    {group.items.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => handleNavigation(item)}
                        className="group flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
                      >
                        {item.icon}
                        <span className="ml-3">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Routes>
            <Route path="taxes" element={<TaxList />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="payments" element={<PaymentList />} />
            <Route path="properties" element={<PropertyList />} />
            <Route path="properties/:propertyId/units" element={<UnitList />} />
            <Route
              path="/"
              element={
                <main className="p-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Properties Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <Home className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">Total Properties</dt>
                              <dd className="text-2xl font-semibold text-gray-900">{stats.totalProperties}</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tenants Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <Users className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">My Tenants</dt>
                              <dd className="text-2xl font-semibold text-gray-900">{stats.totalTenants}</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Occupancy Rate Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <BarChart3 className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">My Occupancy Rate</dt>
                              <dd className="text-2xl font-semibold text-gray-900">{stats.occupancyRate.toFixed(1)}%</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Revenue Card */}
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <DollarSign className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">My Monthly Revenue</dt>
                              <dd className="text-2xl font-semibold text-gray-900">${stats.monthlyRevenue.toLocaleString()}</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </main>
              }
            />
          </Routes>
        </div>
      </div>

      {/* Modal Forms */}
      {showAddProperty && (
        <AddPropertyForm
          onClose={() => setShowAddProperty(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showAddUnit && (
        <AddUnitForm
          onClose={() => setShowAddUnit(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showAddTenant && (
        <AddTenantForm
          onClose={() => setShowAddTenant(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showAddUtility && (
        <AddUtilityForm
          onClose={() => setShowAddUtility(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showAddDeposit && (
        <AddDepositForm
          onClose={() => setShowAddDeposit(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showCreateInvoice && (
        <CreateInvoiceForm
          onClose={() => setShowCreateInvoice(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showAddTax && (
        <AddTaxForm
          onClose={() => setShowAddTax(false)}
          onSuccess={fetchDashboardData}
        />
      )}

      {showMakePayment && (
        <MakePaymentForm
          onClose={() => setShowMakePayment(false)}
          onSuccess={() => {
            setShowMakePayment(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}