import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface GoalItem {
  key: string;
  label: string;
  actual: number;
  target: number | null;
  unit: 'currency' | 'number';
  uncapped_percent: number | null;
  percent: number | null;
}

export interface GoalsData {
  goals: GoalItem[];
}

export interface GoalsUpdatePayload {
  monthly_revenue_target?: number | null;
  monthly_orders_target?: number | null;
  monthly_new_customers_target?: number | null;
}

export async function fetchGoals(): Promise<{ data: GoalsData }> {
  return fetchJson<{ data: GoalsData }>('/admin/goals');
}

export async function updateGoals(payload: GoalsUpdatePayload): Promise<{ data: GoalsData }> {
  return fetchJson<{ data: GoalsData }>('/admin/goals', {
    method: 'PUT',
    body: payload as Record<string, unknown>,
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ['admin-goals'],
    queryFn: fetchGoals,
  });
}

export function useUpdateGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateGoals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-sales'] });
    },
  });
}
