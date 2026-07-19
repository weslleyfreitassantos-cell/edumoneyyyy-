-- Migration para habilitar Identidade Visual das Instituições

-- 1. Adicionar novas colunas na tabela de instituições
ALTER TABLE public.institutions 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS public_slug text;

-- 2. Garantir que public_slug seja único
ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_public_slug_key;

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_public_slug_key UNIQUE (public_slug);

-- 3. Inserir o bucket no storage se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('institution-branding', 'institution-branding', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Criar políticas para o bucket
-- Política de leitura pública (qualquer um pode ver as logos)
CREATE POLICY "Logos publicamente acessíveis"
ON storage.objects FOR SELECT
USING ( bucket_id = 'institution-branding' );

-- Política de inserção/atualização (apenas donos da conta)
CREATE POLICY "Proprietários gerenciam logos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'institution-branding' AND
  EXISTS (
    SELECT 1 FROM public.institutions i
    JOIN public.accounts a ON i.account_id = a.id
    WHERE i.id::text = (storage.foldername(storage.objects.name))[1]
    AND a.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'institution-branding' AND
  EXISTS (
    SELECT 1 FROM public.institutions i
    JOIN public.accounts a ON i.account_id = a.id
    WHERE i.id::text = (storage.foldername(storage.objects.name))[1]
    AND a.owner_profile_id = auth.uid()
  )
);

-- 5. Criar RPC para buscar a instituição pública sem autenticação
CREATE OR REPLACE FUNCTION get_public_institution_branding(lookup_slug text)
RETURNS TABLE (
  name text,
  logo_url text,
  public_slug text
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.name,
    i.logo_url,
    i.public_slug
  FROM public.institutions i
  WHERE i.public_slug = lookup_slug
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
