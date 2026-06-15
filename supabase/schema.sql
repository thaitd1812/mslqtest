-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    dob TEXT,
    parent_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: mslq_results
CREATE TABLE mslq_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    student_id UUID REFERENCES students(id),
    photo_url TEXT,
    answers_jsonb JSONB,
    omr_meta_jsonb JSONB,
    scores_jsonb JSONB,
    report_pdf_url TEXT,
    status TEXT CHECK (status IN ('reading', 'review', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE mslq_results ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only see their own students
CREATE POLICY "Tenant isolation for students" 
ON students FOR ALL 
USING (tenant_id = current_setting('app.current_tenant', true));

-- Policy: Tenants can only see their own results
CREATE POLICY "Tenant isolation for mslq_results" 
ON mslq_results FOR ALL 
USING (tenant_id = current_setting('app.current_tenant', true));

-- Storage: Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('mslq-photos', 'mslq-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('mslq-reports', 'mslq-reports', true);

-- Storage Policies: allow tenant access (requires proper JWT setup, using basic authenticated access here)
CREATE POLICY "Allow authenticated uploads to mslq-photos" 
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mslq-photos');

CREATE POLICY "Allow public read from mslq-reports" 
ON storage.objects FOR SELECT TO public USING (bucket_id = 'mslq-reports');
