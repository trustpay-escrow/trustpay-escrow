-- Initial Schema for TrustPay Escrow

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stellar_address TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('client', 'freelancer', 'arbiter')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    client_address TEXT REFERENCES users(stellar_address) ON DELETE CASCADE,
    freelancer_address TEXT REFERENCES users(stellar_address) ON DELETE SET NULL,
    arbiter_address TEXT REFERENCES users(stellar_address) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('draft', 'in_progress', 'completed', 'disputed')) DEFAULT 'draft',
    budget DECIMAL NOT NULL,
    contract_id TEXT, -- Soroban Contract ID once deployed/funded
    project_id_onchain BIGINT, -- ID returned by create_project on-chain
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Milestones Table
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    milestone_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL NOT NULL,
    status TEXT CHECK (status IN ('pending', 'submitted', 'approved', 'disputed')) DEFAULT 'pending',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disputes Table
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
    raised_by TEXT REFERENCES users(stellar_address),
    reason TEXT NOT NULL,
    status TEXT CHECK (status IN ('open', 'resolved')) DEFAULT 'open',
    resolution_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
