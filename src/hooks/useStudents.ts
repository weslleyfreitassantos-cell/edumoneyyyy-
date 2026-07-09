import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../services/studentService';
import { StudentFormData } from '../schemas/adminSchemas';

export function useStudents(institutionId: string) {
  return useQuery({
    queryKey: ['students', institutionId],
    queryFn: () => studentService.list(institutionId),
    enabled: !!institutionId,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StudentFormData) => studentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
