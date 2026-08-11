#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Vec,
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
    Approved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub state: MilestoneState,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Project {
    pub client: Address,
    pub freelancer: Address,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
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
}

#[contract]
pub struct TrustPayEscrow;

#[contractimpl]
impl TrustPayEscrow {
    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Address,
        arbiter: Address,
        token: Address,
        milestone_amounts: Vec<i128>,
        yield_enabled: bool,
    ) -> u64 {
        client.require_auth();

        let mut total_amount: i128 = 0;
        let mut milestones = Vec::new(&env);
        
        for amount in milestone_amounts.iter() {
            total_amount += amount;
            milestones.push_back(Milestone {
                amount,
                state: MilestoneState::Pending,
            });
        }

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

    pub fn get_project(env: Env, project_id: u64) -> Project {
        env.storage().persistent().get(&DataKey::Project(project_id)).unwrap()
    }

    pub fn accrue_yield(env: Env, project_id: u64, yield_amount: i128) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        assert!(project.yield_enabled, "Yield not enabled for project");
        assert!(project.state == ProjectState::Active, "Project not active");
        
        project.accrued_yield += yield_amount;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    pub fn submit_milestone(env: Env, project_id: u64, milestone_index: u32) {
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        project.freelancer.require_auth();
        assert!(project.state == ProjectState::Active, "Project is not active");
        
        let mut milestone = project.milestones.get(milestone_index).unwrap();
        assert!(milestone.state == MilestoneState::Pending, "Milestone not pending");
        
        milestone.state = MilestoneState::Submitted;
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

        // Release milestone funds to freelancer
        let token_client = token::Client::new(&env, &project.token);
        token_client.transfer(&env.current_contract_address(), &project.freelancer, &milestone.amount);
        
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

    pub fn raise_dispute(env: Env, caller: Address, project_id: u64) {
        caller.require_auth();
        let mut project: Project = env.storage().persistent().get(&DataKey::Project(project_id)).unwrap();
        
        assert!(caller == project.client || caller == project.freelancer, "Not authorized");
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
        
        let token_client = token::Client::new(&env, &project.token);
        
        if client_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &project.client, &client_amount);
        }
        if freelancer_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &project.freelancer, &freelancer_amount);
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
