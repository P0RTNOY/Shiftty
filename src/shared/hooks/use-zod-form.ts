import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

export function useZodForm<TValues extends FieldValues>(
  schema: z.ZodType<TValues, TValues>,
  options?: UseFormProps<TValues, unknown, TValues>,
): UseFormReturn<TValues, unknown, TValues> {
  return useForm<TValues, unknown, TValues>({
    ...options,
    resolver: zodResolver(schema),
  });
}
