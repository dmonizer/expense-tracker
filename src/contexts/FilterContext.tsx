import {createContext, type ReactNode, useCallback, useContext, useMemo, useState} from 'react';
/* eslint-disable react-refresh/only-export-components */
// This file exports both the FilterProvider component and the useFilters hook
// which is a standard React context pattern
import {endOfMonth, startOfMonth, subMonths} from 'date-fns';
import type {TransactionFilters} from '@/types';

export type DateRangePreset = 'all' | 'thisMonth' | 'last3Months' | 'year' | 'custom';

export type DrilldownView = 'groups' | 'group' | 'category';

interface FilterState {
  // Date range
  dateRangePreset: DateRangePreset;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  customDateFrom: string;
  customDateTo: string;

  // Drilldown state
  drilldownView: DrilldownView;
  selectedGroupId: string | null;
  selectedCategory: string | null;

  // Currency
  currencies: string[];
  setCurrencies: (currencies: string[]) => void;
}

interface FilterContextValue extends FilterState {
  // Date range actions
  setDateRangePreset: (preset: DateRangePreset) => void;
  setCustomDateRange: (from: string, to: string) => void;

  // Drilldown actions
  drillDownToGroup: (groupId: string) => void;
  drillDownToCategory: (category: string) => void;
  goBackToGroups: () => void;
  goBackOneLevel: () => void;
  clearCategoryFilter: () => void;

  // Reset
  resetAllFilters: () => void;

  // Computed filters
  getTransactionFilters: () => TransactionFilters;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [dateRangePreset, setDateRangePresetState] = useState<DateRangePreset>('thisMonth');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [drilldownView, setDrilldownView] = useState<DrilldownView>('groups');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currencies, setCurrenciesState] = useState<string[]>([]);

  // Compute date range based on preset
  const { dateFrom, dateTo } = useMemo(() => {
    let from: Date | undefined;
    let to: Date | undefined;

    switch (dateRangePreset) {
      case 'all':
        // No date restrictions - show all transactions
        from = undefined;
        to = undefined;
        break;
      case 'thisMonth':
        from = startOfMonth(new Date());
        to = endOfMonth(new Date());
        break;
      case 'last3Months':
        from = startOfMonth(subMonths(new Date(), 2));
        to = endOfMonth(new Date());
        break;
      case 'year':
        from = new Date(new Date().getFullYear(), 0, 1);
        to = new Date(new Date().getFullYear(), 11, 31);
        break;
      case 'custom':
        if (customDateFrom) {
          from = new Date(customDateFrom);
        }
        if (customDateTo) {
          to = new Date(customDateTo);
        }
        break;
    }

    return { dateFrom: from, dateTo: to };
  }, [dateRangePreset, customDateFrom, customDateTo]);

  // Date range actions
  const setDateRangePreset = useCallback((preset: DateRangePreset) => {
    setDateRangePresetState(preset);
    // Reset drilldown when changing date range
    if (preset !== 'custom') {
      setDrilldownView('groups');
      setSelectedGroupId(null);
      setSelectedCategory(null);
    }
  }, []);

  const setCustomDateRange = useCallback((from: string, to: string) => {
    setCustomDateFrom(from);
    setCustomDateTo(to);
  }, []);

  // Drilldown actions
  const drillDownToGroup = useCallback((groupId: string) => {
    setDrilldownView('group');
    setSelectedGroupId(groupId);
    setSelectedCategory(null);
  }, []);

  const drillDownToCategory = useCallback((category: string) => {
    setDrilldownView('category');
    setSelectedCategory(category);
  }, []);

  const goBackToGroups = useCallback(() => {
    setDrilldownView('groups');
    setSelectedGroupId(null);
    setSelectedCategory(null);
  }, []);

  const goBackOneLevel = useCallback(() => {
    if (drilldownView === 'category') {
      // Go back from category to group view
      setDrilldownView('group');
      setSelectedCategory(null);
    } else if (drilldownView === 'group') {
      // Go back from group to groups overview
      setDrilldownView('groups');
      setSelectedGroupId(null);
      setSelectedCategory(null);
    }
    // If already at 'groups' level, do nothing
  }, [drilldownView]);

  const clearCategoryFilter = useCallback(() => {
    if (drilldownView === 'category' && selectedGroupId) {
      // If we're in category view with a selected group, go back to group view
      setDrilldownView('group');
      setSelectedCategory(null);
    } else {
      // Otherwise, go back to groups view
      goBackToGroups();
    }
  }, [drilldownView, selectedGroupId, goBackToGroups]);

  const resetAllFilters = useCallback(() => {
    setDateRangePresetState('thisMonth');
    setCustomDateFrom('');
    setCustomDateTo('');
    setDrilldownView('groups');
    setSelectedGroupId(null);
    setSelectedCategory(null);
    setCurrenciesState([]);
  }, []);

  // Compute transaction filters based on current state
  const getTransactionFilters = useCallback((): TransactionFilters => {
    const filters: TransactionFilters = {};

    // Add currency filter if specified
    if (currencies.length > 0) {
      filters.currencies = currencies;
    }

    // Add date range
    if (dateFrom) {
      filters.dateFrom = dateFrom;
    }
    if (dateTo) {
      filters.dateTo = dateTo;
    }

    // Add drilldown filters
    if (drilldownView === 'category' && selectedCategory) {
      // Most specific: filter by category
      filters.categories = [selectedCategory];
    } else if (drilldownView === 'group' && selectedGroupId) {
      // Filter by group
      filters.groups = [selectedGroupId];
    }
    // If drilldownView === 'groups', no category/group filter applied

    return filters;
  }, [dateFrom, dateTo, drilldownView, selectedGroupId, selectedCategory, currencies]);

  const value: FilterContextValue = {
    // State
    dateRangePreset,
    dateFrom,
    dateTo,
    customDateFrom,
    customDateTo,
    drilldownView,
    selectedGroupId,
    selectedCategory,
    currencies,

    // Actions
    setDateRangePreset,
    setCustomDateRange,
    setCurrencies: setCurrenciesState,
    drillDownToGroup,
    drillDownToCategory,
    goBackToGroups,
    goBackOneLevel,
    clearCategoryFilter,
    resetAllFilters,
    getTransactionFilters,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
