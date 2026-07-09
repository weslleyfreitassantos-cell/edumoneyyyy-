import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useStudents, useCreateStudent } from '../../../hooks/useStudents';
import { DataTable } from '../../../components/DataTable';
import { StudentFormData } from '../../../schemas/adminSchemas';
import { supabase } from '../../../lib/supabaseClient';

export default function StudentsTab() {
  const { profile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentFormData>>({});
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState<string>('');

  useEffect(() => {
    async function getInstitutionId() {
      if (!profile) return;
      const { data, error } = await supabase
        .from('memberships')
        .select('institution_id')
        .eq('profile_id', profile.id)
        .single();
      if (!error && data) {
        setInstitutionId(data.institution_id);
      }
    }
    getInstitutionId();
  }, [profile]);

  const { data: students, isLoading } = useStudents(institutionId);
  const createMutation = useCreateStudent();

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'STUDENT');
    setAvailableProfiles(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        ...formData,
        institution_id: institutionId,
        active: true,
      } as StudentFormData);
      setIsModalOpen(false);
      setFormData({});
    } catch (error) {
      console.error(error);
      alert('Erro ao criar aluno.');
    }
  };

  const columns = [
    { key: 'registration_number', label: 'RA' },
    {
      key: 'profile_id',
      label: 'Nome',
      render: (value: any, row: any) => row.profiles?.full_name || value,
    },
    {
      key: 'profile_id',
      label: 'E-mail',
      render: (value: any, row: any) => row.profiles?.email || '',
    },
    { key: 'birth_date', label: 'Data Nasc.' },
    {
      key: 'active',
      label: 'Ativo',
      render: (value: any) => (value ? 'Sim' : 'Não'),
    },
  ];

  return (
    <div>
      <DataTable
        data={students || []}
        columns={columns}
        onAdd={() => {
          loadProfiles();
          setIsModalOpen(true);
        }}
        isLoading={isLoading}
        onDelete={(row) => {
          if (confirm(`Excluir aluno ${row.profiles?.full_name}?`)) {
            // Implementar delete depois
          }
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Novo Aluno</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Perfil (usuário)</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.profile_id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, profile_id: e.target.value })
                  }
                  required
                >
                  <option value="">Selecione um perfil</option>
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">RA</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={formData.registration_number || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, registration_number: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Data Nascimento</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={formData.birth_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, birth_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">CPF (opcional)</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={formData.cpf || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, cpf: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#005bbf] text-white rounded hover:bg-[#1a73e8]"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}