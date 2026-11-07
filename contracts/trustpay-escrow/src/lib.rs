#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Vec,
};

#[cfg(test)]
mod test;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProjectState {
    Active,
    Disputed,
    Completed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneState {
    Pending,
    Submitted,
    InRevision,
    Approved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub state: MilestoneState,
    pub submitted_at: u64,
    pub deliverable_hash: Option<String>,
    pub revisions_remaining: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Project {
    pub client: Address,
    pub freelancer: Option<Address>,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
    pub remaining_amount: i128,
    pub milestones: Vec<Milestone>,
    pub state: ProjectState,
    pub yield_enabled: bool,
    pub principal_liquid: i128,
    pub principal_blend: i128,
    pub accrued_yield: i128,
}

#[contracttype]
pub enum DataKey {
    Project(u64),
    ProjectCount,
    Admin,
    Oracle,
}

#[contract]
pub struct TrustPayEscrow;

#[contractimpl]
impl TrustPayEscrow {
    pub fn initialize(env: Env, admin: Address, oracle: Option<Address>) {
        assert!(!env.storage().persistent().has(&DataKey::Admin), "Already initialized");
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        if let Some(o) = oracle {
            env.storage().persistent().set(&DataKey::Oracle, &o);
        }
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin not set");
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
    }

    pub fn set_oracle(env: Env, oracle: Address) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("Admin not set");
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Oracle, &oracle);
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Admin)
    }

    pub fn get_oracle(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Oracle)
    }

    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Option<Address>,
        arbiter: Address,
        token: Address,
        milestone_amounts: Vec<i128>,
        yield_enabled: bool,
    ) -> u64 {
        client.require_auth();

        let mut total_amount: i128 = 0;
        let mut milestones = Vec::new(&env);
        
        for amount in milestone_amounts.iter() {
            assert!(amount > 0, "Milestone amount must be positive");
            total_amount = total_amount.checked_add(amount).expect("Total amount overflow");
            milestones.push_back(Milestone {
                amount,
                state: MilestoneState::Pending,
                submitted_at: 0,
                deliverable_hash: None,
                revisions_remaining: 2,
            });
        }

        assert!(total_amount > 0, "Project must have positive total amount");

        // Transfer total funds from client to contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &total_amount);

        // Principal split calculation
        let (principal_blend, principal_liquid) = if yield_enabled {
            let blend = (total_amount * 70) / 100;
            let liquid = total_amount - blend;
            (blend, liquid)
        } else {
            (0, total_amount)
        };

        let project = Project {
            client,
            freelancer,
            arbiter,
            token,
            total_amount,
            remaining_amount: total_amount,
            milestones,
            state: ProjectState::Active,
            yield_enabled,
            principal_liquid,
            principal_blend,
            accrued_yield: 0,
        };

        let count: u64 = env.storage().persistent().get(&DataKey::ProjectCount).unwrap_or(0);
        let project_id = count + 1;
        
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
        env.storage().persistent().set(&DataKey::ProjectCount, &project_id);
        
        project_id
    }

    /// Atomic deposit-on-award (Option A): locks funds and binds winning freelancer in one atomic transaction.
    pub fn lock_escrow(
        env: Env,
        client: Address,
        freelancer: Address,
        arbiter: Address,
        token: Address,
        milestone_amounts: Vec<i128>,
        yield_enabled: bool,
    ) -> u64 {
        Self::create_project(
            env,
            client,
            Some(freelancer),
            arbiter,
            token,
            milestone_amounts,
            yield_enabled,
        )
    }

    /// Assigns the winning freelancer to an upfront-funded unassigned project (Option B).
    pub fn assign_freelancer(
        env: Env,
        project_id: u64,
        freelancer: Address,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        project.client.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        assert!(project.freelancer.is_none(), "Freelancer already assigned");

        project.freelancer = Some(freelancer);
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    /// Cancels an unassigned project and refunds 100% of deposited escrow funds to the client.
    /// Only callable by the client before any freelancer has been assigned.
    pub fn cancel_unassigned_project(env: Env, project_id: u64) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        project.client.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        assert!(project.freelancer.is_none(), "Cannot cancel once freelancer is assigned");

        let refund_amount = project.remaining_amount;
        assert!(refund_amount > 0, "No funds to refund");

        project.remaining_amount = 0;
        project.state = ProjectState::Completed;

        let token_client = token::Client::new(&env, &project.token);
        token_client.transfer(&env.current_contract_address(), &project.client, &refund_amount);

        if project.yield_enabled && project.accrued_yield > 0 {
            token_client.transfer(&env.current_contract_address(), &project.client, &project.accrued_yield);
            project.accrued_yield = 0;
        }

        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn get_project(env: Env, project_id: u64) -> Project {
        env.storage().persistent().get(&DataKey::Project(project_id)).unwrap()
    }

    pub fn accrue_yield(env: Env, caller: Address, project_id: u64, yield_amount: i128) {
        caller.require_auth();
        assert!(yield_amount > 0, "Yield amount must be positive");

        let admin_opt: Option<Address> = env.storage().persistent().get(&DataKey::Admin);
        let oracle_opt: Option<Address> = env.storage().persistent().get(&DataKey::Oracle);

        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();

        let is_oracle = oracle_opt.map_or(false, |o| o == caller);
        let is_admin = admin_opt.map_or(false, |a| a == caller);
        let is_arbiter = project.arbiter == caller;

        assert!(is_oracle || is_admin || is_arbiter, "Caller not authorized oracle or admin");
        assert!(project.yield_enabled, "Yield not enabled for project");
        assert!(project.state == ProjectState::Active || project.state == ProjectState::Disputed, "Project not active or disputed");

        project.accrued_yield = project.accrued_yield.checked_add(yield_amount).expect("Yield overflow");
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn set_milestone_revision_limit(
        env: Env,
        project_id: u64,
        milestone_index: u32,
        revision_limit: u32,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        project.client.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(milestone.state == MilestoneState::Pending, "Milestone must be pending");
        milestone.revisions_remaining = revision_limit;
        project.milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn submit_milestone(
        env: Env,
        project_id: u64,
        milestone_index: u32,
        deliverable_hash: String,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        let freelancer = project.freelancer.as_ref().expect("Freelancer not assigned yet");
        freelancer.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        assert!(deliverable_hash.len() > 0, "Deliverable hash cannot be empty");
        
        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(
            milestone.state == MilestoneState::Pending || milestone.state == MilestoneState::InRevision,
            "Milestone not in pending or in-revision state"
        );
        
        milestone.state = MilestoneState::Submitted;
        milestone.submitted_at = env.ledger().timestamp();
        milestone.deliverable_hash = Some(deliverable_hash);
        project.milestones.set(milestone_index, milestone);
        
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn request_revision(
        env: Env,
        project_id: u64,
        milestone_index: u32,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        project.client.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        
        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(milestone.state == MilestoneState::Submitted, "Milestone not submitted");
        assert!(milestone.revisions_remaining > 0, "No revisions remaining for milestone");
        
        milestone.revisions_remaining -= 1;
        milestone.state = MilestoneState::InRevision;
        milestone.submitted_at = 0; // Resets 7-day auto-release timelock
        project.milestones.set(milestone_index, milestone);
        
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn approve_milestone(env: Env, project_id: u64, milestone_index: u32, platform: Option<Address>) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        project.client.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        
        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(milestone.state == MilestoneState::Submitted, "Milestone not submitted");
        
        milestone.state = MilestoneState::Approved;
        project.milestones.set(milestone_index, milestone.clone());

        // Invariant guard: update remaining escrowed funds
        assert!(project.remaining_amount >= milestone.amount, "Insufficient escrow balance");
        project.remaining_amount = project.remaining_amount.checked_sub(milestone.amount).expect("Remaining balance underflow");

        // Release milestone funds to freelancer
        let freelancer = project.freelancer.as_ref().expect("Freelancer not assigned yet");
        let token_client = token::Client::new(&env, &project.token);
        token_client.transfer(&env.current_contract_address(), freelancer, &milestone.amount);
        
        // Check if all completed
        let mut all_completed = true;
        for m in project.milestones.iter() {
            if m.state != MilestoneState::Approved {
                all_completed = false;
                break;
            }
        }
        if all_completed {
            project.state = ProjectState::Completed;

            // Distribute accrued yield if yield is enabled
            if project.yield_enabled && project.accrued_yield > 0 {
                let client_yield = (project.accrued_yield * 70) / 100;
                let platform_yield = project.accrued_yield - client_yield;

                if client_yield > 0 {
                    token_client.transfer(&env.current_contract_address(), &project.client, &client_yield);
                }
                if platform_yield > 0 {
                    let platform_recipient = platform.unwrap_or_else(|| project.arbiter.clone());
                    token_client.transfer(&env.current_contract_address(), &platform_recipient, &platform_yield);
                }
                project.accrued_yield = 0;
            }
        }

        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    /// Automatically releases milestone escrow funds to the freelancer once the 7-day review timelock expires.
    /// Can be executed by the freelancer, a platform relayer, or any caller without requiring client authorization.
    pub fn auto_release_milestone(
        env: Env,
        project_id: u64,
        milestone_index: u32,
        platform: Option<Address>,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        assert!(project.state == ProjectState::Active, "Project is not active");

        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(milestone.state == MilestoneState::Submitted, "Milestone not submitted");

        let now = env.ledger().timestamp();
        let auto_release_delay: u64 = 7 * 24 * 60 * 60; // 7 days in seconds (604,800s)
        assert!(
            now >= milestone.submitted_at + auto_release_delay,
            "Timelock review period has not expired"
        );

        milestone.state = MilestoneState::Approved;
        project.milestones.set(milestone_index, milestone.clone());

        // Invariant guard: update remaining escrowed funds
        assert!(project.remaining_amount >= milestone.amount, "Insufficient escrow balance");
        project.remaining_amount = project.remaining_amount.checked_sub(milestone.amount).expect("Remaining balance underflow");

        // Release milestone funds directly to freelancer
        let freelancer = project.freelancer.as_ref().expect("Freelancer not assigned yet");
        let token_client = token::Client::new(&env, &project.token);
        token_client.transfer(&env.current_contract_address(), freelancer, &milestone.amount);

        // Check if all milestones completed and handle final project settlement & yield
        let mut all_completed = true;
        for m in project.milestones.iter() {
            if m.state != MilestoneState::Approved {
                all_completed = false;
                break;
            }
        }
        if all_completed {
            project.state = ProjectState::Completed;

            if project.yield_enabled && project.accrued_yield > 0 {
                let client_yield = (project.accrued_yield * 70) / 100;
                let platform_yield = project.accrued_yield - client_yield;

                if client_yield > 0 {
                    token_client.transfer(&env.current_contract_address(), &project.client, &client_yield);
                }
                if platform_yield > 0 {
                    let platform_recipient = platform.unwrap_or_else(|| project.arbiter.clone());
                    token_client.transfer(&env.current_contract_address(), &platform_recipient, &platform_yield);
                }
                project.accrued_yield = 0;
            }
        }

        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn raise_dispute(env: Env, caller: Address, project_id: u64) {
        caller.require_auth();
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        let is_client = caller == project.client;
        let is_freelancer = project.freelancer.as_ref().map_or(false, |f| *f == caller);
        assert!(is_client || is_freelancer, "Not authorized");
        assert!(project.state == ProjectState::Active, "Project is not active");
        
        project.state = ProjectState::Disputed;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn resolve_dispute(
        env: Env,
        project_id: u64,
        client_amount: i128,
        freelancer_amount: i128,
        platform: Option<Address>,
    ) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        project.arbiter.require_auth();
        assert!(project.state == ProjectState::Disputed, "Project is not disputed");
        assert!(client_amount >= 0, "Client amount cannot be negative");
        assert!(freelancer_amount >= 0, "Freelancer amount cannot be negative");

        // Balance invariant check: prevent arbitrator from exceeding remaining escrowed funds or draining pool
        let total_resolution = client_amount.checked_add(freelancer_amount).expect("Resolution amount overflow");
        assert!(total_resolution <= project.remaining_amount, "Resolution exceeds escrowed balance");

        project.remaining_amount = project.remaining_amount.checked_sub(total_resolution).expect("Underflow");

        let token_client = token::Client::new(&env, &project.token);
        
        if client_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &project.client, &client_amount);
        }
        if freelancer_amount > 0 {
            let freelancer = project.freelancer.as_ref().expect("Freelancer not assigned yet");
            token_client.transfer(&env.current_contract_address(), freelancer, &freelancer_amount);
        }

        // If yield was enabled, distribute yield shares (70% client, 30% platform) upon dispute resolution
        if project.yield_enabled && project.accrued_yield > 0 {
            let client_yield = (project.accrued_yield * 70) / 100;
            let platform_yield = project.accrued_yield - client_yield;

            if client_yield > 0 {
                token_client.transfer(&env.current_contract_address(), &project.client, &client_yield);
            }
            if platform_yield > 0 {
                let platform_recipient = platform.unwrap_or_else(|| project.arbiter.clone());
                token_client.transfer(&env.current_contract_address(), &platform_recipient, &platform_yield);
            }
            project.accrued_yield = 0;
        }
        
        project.state = ProjectState::Completed;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }
}
