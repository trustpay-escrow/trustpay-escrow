#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _, testutils::Events as _, testutils::Ledger as _, Address, Env, String,
    Vec,
};
use soroban_sdk::token;

#[test]
fn test_create_project() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);
    
    // Create a mock token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin.clone());
    let token = token::StellarAssetClient::new(&env, &token_contract);
    
    // Mint some tokens to the client
    token.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(500);
    amounts.push_back(500);

    let project_id = client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    assert_eq!(project_id, 1);

    let project = client.get_project(&project_id);
    assert_eq!(project.freelancer, Some(freelancer_addr));
    assert_eq!(project.yield_enabled, false);
    assert_eq!(project.total_amount, 1000);
    assert_eq!(project.remaining_amount, 1000);
    assert_eq!(project.principal_liquid, 1000);
    assert_eq!(project.principal_blend, 0);
}

#[test]
fn test_multi_token_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    // Test creating projects with different token contracts (USDC, EURC, XLM, PYUSD)
    let tokens = ["USDC_ADMIN", "EURC_ADMIN", "XLM_ADMIN", "PYUSD_ADMIN"];

    for (idx, _name) in tokens.iter().enumerate() {
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token_contract);
        let sac_token = token::Client::new(&env, &token_contract);

        // Mint 2000 tokens to client
        token_client.mint(&client_addr, &2000);

        let mut amounts = Vec::new(&env);
        amounts.push_back(1000);
        amounts.push_back(1000);

        let p_id = escrow_client.create_project(
            &client_addr,
            &Some(freelancer_addr.clone()),
            &arbiter_addr,
            &token_contract,
            &amounts,
            &false,
        );

        assert_eq!(p_id, (idx as u64) + 1);

        // Submit and approve first milestone
        let deliverable = String::from_str(&env, "ipfs://QmMultiTokenEscrowMilestoneCID");
        escrow_client.submit_milestone(&p_id, &0, &deliverable);
        escrow_client.approve_milestone(&p_id, &0, &None);

        // Freelancer should have received 1000 tokens of this specific token
        assert_eq!(sac_token.balance(&freelancer_addr), 1000);
        let p_after = escrow_client.get_project(&p_id);
        assert_eq!(p_after.remaining_amount, 1000);
    }
}

#[test]
fn test_yield_enabled_principal_split() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    // Deposit 1000 USDC
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    // Create project with Yield Toggle ON
    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.yield_enabled, true);
    // 70% in Blend = 700
    assert_eq!(proj.principal_blend, 700);
    // 30% liquid reserve = 300
    assert_eq!(proj.principal_liquid, 300);
}

#[test]
fn test_yield_interest_split_on_milestone_approval() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);
    let platform_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    // Deposit 1000 tokens
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    // Simulate interest earned from Blend (100 tokens of yield minted to contract)
    token_admin_client.mint(&contract_id, &100);
    escrow_client.accrue_yield(&arbiter_addr, &p_id, &100);

    // Submit and approve milestone
    let deliverable = String::from_str(&env, "ipfs://QmYieldMilestoneCID");
    escrow_client.submit_milestone(&p_id, &0, &deliverable);
    escrow_client.approve_milestone(&p_id, &0, &Some(platform_addr.clone()));

    // Freelancer receives exact milestone amount (1000 tokens) - 0% yield share
    assert_eq!(token_client.balance(&freelancer_addr), 1000);

    // 70% of 100 yield -> Client (70 tokens)
    assert_eq!(token_client.balance(&client_addr), 70);

    // 30% of 100 yield -> Platform fee (30 tokens)
    assert_eq!(token_client.balance(&platform_addr), 30);
}

#[test]
fn test_yield_dispute_resolution_with_reserve() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);
    let platform_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    // Raise dispute
    escrow_client.raise_dispute(&client_addr, &p_id);

    // Accrue yield (50 tokens yield)
    token_admin_client.mint(&contract_id, &50);
    escrow_client.accrue_yield(&arbiter_addr, &p_id, &50);

    // Resolve dispute: 400 to client, 600 to freelancer
    escrow_client.resolve_dispute(&p_id, &400, &600, &Some(platform_addr.clone()));

    // Freelancer gets 600
    assert_eq!(token_client.balance(&freelancer_addr), 600);

    // Client gets 400 principal + 70% of 50 yield (35) = 435 total
    assert_eq!(token_client.balance(&client_addr), 435);

    // Platform gets 30% of 50 yield (15)
    assert_eq!(token_client.balance(&platform_addr), 15);
}

#[test]
fn test_auto_release_milestone_timelock() {
    let env = Env::default();
    env.mock_all_auths();

    // Set initial ledger timestamp
    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(600);
    amounts.push_back(400);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Freelancer submits milestone 0 at timestamp 1_000_000
    let deliverable = String::from_str(&env, "ipfs://QmAutoReleaseMilestoneCID");
    escrow_client.submit_milestone(&p_id, &0, &deliverable);
    let proj_after_sub = escrow_client.get_project(&p_id);
    let m0 = proj_after_sub.milestones.get(0).unwrap();
    assert_eq!(m0.state, MilestoneState::Submitted);
    assert_eq!(m0.submitted_at, 1_000_000);

    // Fast-forward ledger time past 7 days (7 * 24 * 60 * 60 = 604_800s)
    // 1_000_000 + 604_800 = 1_604_800
    env.ledger().set_timestamp(1_000_000 + 604_800);

    // Call auto_release_milestone (caller can be anyone, does not require client.require_auth())
    escrow_client.auto_release_milestone(&p_id, &0, &None);

    // Freelancer balance should now be 600
    assert_eq!(token_client.balance(&freelancer_addr), 600);

    let proj_after_release = escrow_client.get_project(&p_id);
    assert_eq!(proj_after_release.milestones.get(0).unwrap().state, MilestoneState::Approved);
}

#[test]
#[should_panic(expected = "Timelock review period has not expired")]
fn test_auto_release_before_timelock_fails() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let deliverable = String::from_str(&env, "ipfs://QmAutoReleaseMilestoneCID");
    escrow_client.submit_milestone(&p_id, &0, &deliverable);

    // Advance only 6 days (518_400 seconds)
    env.ledger().set_timestamp(1_000_000 + 518_400);

    // Must panic because 7 days have not elapsed
    escrow_client.auto_release_milestone(&p_id, &0, &None);
}

#[test]
#[should_panic(expected = "Resolution exceeds escrowed balance")]
fn test_resolve_dispute_exceeding_balance_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&client_addr, &p_id);

    // Arbiter attempts to resolve 600 + 500 = 1100 when only 1000 is locked in escrow
    escrow_client.resolve_dispute(&p_id, &600, &500, &None);
}

#[test]
#[should_panic(expected = "Client amount cannot be negative")]
fn test_resolve_dispute_negative_amounts_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&client_addr, &p_id);

    // Arbiter attempts to pass negative amount
    escrow_client.resolve_dispute(&p_id, &-100, &500, &None);
}

#[test]
#[should_panic(expected = "Resolution exceeds escrowed balance")]
fn test_multi_project_drain_prevention() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client1 = Address::generate(&env);
    let freelancer1 = Address::generate(&env);
    let arbiter1 = Address::generate(&env);

    let client2 = Address::generate(&env);
    let freelancer2 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    // Client 1 deposits 500, Client 2 deposits 2000
    token_admin_client.mint(&client1, &500);
    token_admin_client.mint(&client2, &2000);

    let mut amounts1 = Vec::new(&env);
    amounts1.push_back(500);

    let mut amounts2 = Vec::new(&env);
    amounts2.push_back(2000);

    let p1 = escrow_client.create_project(&client1, &Some(freelancer1), &arbiter1, &token_contract, &amounts1, &false);
    let _p2 = escrow_client.create_project(&client2, &Some(freelancer2), &arbiter2, &token_contract, &amounts2, &false);

    // Escrow contract balance is now 2500 total
    escrow_client.raise_dispute(&client1, &p1);

    // Arbiter 1 tries to award 1500 to client1 on Project 1 (attempting to drain Project 2's funds)
    escrow_client.resolve_dispute(&p1, &1500, &0, &None);
}

#[test]
#[should_panic(expected = "Caller not authorized oracle or admin")]
fn test_accrue_yield_unauthorized_caller_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);
    let random_stranger = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    // Random stranger attempts to call accrue_yield
    escrow_client.accrue_yield(&random_stranger, &p_id, &500);
}

#[test]
fn test_accrue_yield_authorized_oracle_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    escrow_client.initialize(&admin, &Some(oracle.clone()));

    assert_eq!(escrow_client.get_admin(), Some(admin));
    assert_eq!(escrow_client.get_oracle(), Some(oracle.clone()));

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    // Mint yield to contract and call accrue_yield as authorized oracle
    token_admin_client.mint(&contract_id, &75);
    escrow_client.accrue_yield(&oracle, &p_id, &75);

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.accrued_yield, 75);
}

#[test]
fn test_unassigned_escrow_and_assign_freelancer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    // Option B: Client posts open job and funds escrow upfront without a freelancer assigned
    let p_id = escrow_client.create_project(
        &client_addr,
        &None,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let proj_init = escrow_client.get_project(&p_id);
    assert_eq!(proj_init.freelancer, None);
    assert_eq!(proj_init.remaining_amount, 1000);
    assert_eq!(token_client.balance(&contract_id), 1000);

    // Client accepts winning freelancer proposal and binds them on-chain
    escrow_client.assign_freelancer(&p_id, &freelancer_addr);

    let proj_assigned = escrow_client.get_project(&p_id);
    assert_eq!(proj_assigned.freelancer, Some(freelancer_addr.clone()));

    // Assigned freelancer submits and gets approved
    let deliverable = String::from_str(&env, "ipfs://QmAutoReleaseMilestoneCID");
    escrow_client.submit_milestone(&p_id, &0, &deliverable);
    escrow_client.approve_milestone(&p_id, &0, &None);

    assert_eq!(token_client.balance(&freelancer_addr), 1000);
}

#[test]
#[should_panic(expected = "Freelancer not assigned yet")]
fn test_cannot_submit_milestone_if_freelancer_unassigned() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &None,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Should panic because freelancer is not assigned yet
    let deliverable = String::from_str(&env, "ipfs://QmAutoReleaseMilestoneCID");
    escrow_client.submit_milestone(&p_id, &0, &deliverable);
}

#[test]
#[should_panic(expected = "Freelancer already assigned")]
fn test_cannot_reassign_freelancer_once_assigned() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer1 = Address::generate(&env);
    let freelancer2 = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &Some(freelancer1),
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Attempting to overwrite assigned freelancer must panic
    escrow_client.assign_freelancer(&p_id, &freelancer2);
}

#[test]
fn test_cancel_unassigned_project_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.create_project(
        &client_addr,
        &None,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    assert_eq!(token_client.balance(&client_addr), 0);
    assert_eq!(token_client.balance(&contract_id), 1000);

    // Client cancels the unassigned project and gets a 100% refund
    escrow_client.cancel_unassigned_project(&p_id);

    assert_eq!(token_client.balance(&client_addr), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.remaining_amount, 0);
    assert_eq!(proj.state, ProjectState::Completed);
}

#[test]
fn test_lock_escrow_atomic_award() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    // Option A: Client signs lock_escrow on award
    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.freelancer, Some(freelancer_addr));
    assert_eq!(proj.remaining_amount, 1000);
}

#[test]
fn test_submit_milestone_stores_deliverable_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let ipfs_hash = String::from_str(&env, "bafybeicysadkjfhw98yfhewiufh98wehf");
    escrow_client.submit_milestone(&p_id, &0, &ipfs_hash);

    let proj = escrow_client.get_project(&p_id);
    let m = proj.milestones.get(0).unwrap();
    assert_eq!(m.state, MilestoneState::Submitted);
    assert_eq!(m.deliverable_hash, Some(ipfs_hash));
    assert_eq!(m.revisions_remaining, 2);
}

#[test]
#[should_panic(expected = "Deliverable hash cannot be empty")]
fn test_submit_milestone_empty_hash_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let empty_hash = String::from_str(&env, "");
    escrow_client.submit_milestone(&p_id, &0, &empty_hash);
}

#[test]
fn test_request_revision_cycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Initial deliverable submission
    let initial_hash = String::from_str(&env, "ipfs://QmFirstDraftHash123");
    escrow_client.submit_milestone(&p_id, &0, &initial_hash);

    let proj_sub = escrow_client.get_project(&p_id);
    let m_sub = proj_sub.milestones.get(0).unwrap();
    assert_eq!(m_sub.state, MilestoneState::Submitted);
    assert_eq!(m_sub.revisions_remaining, 2);

    // Client requests revision
    escrow_client.request_revision(&p_id, &0);

    let proj_rev = escrow_client.get_project(&p_id);
    let m_rev = proj_rev.milestones.get(0).unwrap();
    assert_eq!(m_rev.state, MilestoneState::InRevision);
    assert_eq!(m_rev.revisions_remaining, 1);
    assert_eq!(m_rev.submitted_at, 0); // Timelock reset

    // Freelancer resubmits revised work with new proof
    let revised_hash = String::from_str(&env, "ipfs://QmRevisedDeliverableHash456");
    escrow_client.submit_milestone(&p_id, &0, &revised_hash);

    let proj_resub = escrow_client.get_project(&p_id);
    let m_resub = proj_resub.milestones.get(0).unwrap();
    assert_eq!(m_resub.state, MilestoneState::Submitted);
    assert_eq!(m_resub.deliverable_hash, Some(revised_hash));
    assert_eq!(m_resub.revisions_remaining, 1);

    // Client approves revised milestone
    escrow_client.approve_milestone(&p_id, &0, &None);

    let proj_final = escrow_client.get_project(&p_id);
    let m_final = proj_final.milestones.get(0).unwrap();
    assert_eq!(m_final.state, MilestoneState::Approved);
    assert_eq!(token_client.balance(&freelancer_addr), 1000);
}

#[test]
#[should_panic(expected = "No revisions remaining for milestone")]
fn test_request_revision_limit_exhausted_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Set revision limit to exactly 1
    escrow_client.set_milestone_revision_limit(&p_id, &0, &1);

    let hash1 = String::from_str(&env, "ipfs://QmDraft1");
    escrow_client.submit_milestone(&p_id, &0, &hash1);

    // First revision request succeeds (revisions_remaining -> 0)
    escrow_client.request_revision(&p_id, &0);

    let hash2 = String::from_str(&env, "ipfs://QmDraft2");
    escrow_client.submit_milestone(&p_id, &0, &hash2);

    // Second revision request must panic as revisions are exhausted
    escrow_client.request_revision(&p_id, &0);
}

#[test]
#[should_panic(expected = "Milestone not submitted")]
fn test_auto_release_fails_while_in_revision() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let hash = String::from_str(&env, "ipfs://QmDraft");
    escrow_client.submit_milestone(&p_id, &0, &hash);
    escrow_client.request_revision(&p_id, &0);

    // Even if time passes, auto_release cannot execute while InRevision
    env.ledger().set_timestamp(env.ledger().timestamp() + 10 * 24 * 60 * 60);
    escrow_client.auto_release_milestone(&p_id, &0, &None);
}

#[test]
fn test_contract_emits_structured_events() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    let hash = String::from_str(&env, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
    escrow_client.submit_milestone(&p_id, &0, &hash);
    escrow_client.approve_milestone(&p_id, &0, &None);

    let events = env.events().all();
    assert!(!events.is_empty(), "Expected structured contract events emitted");
}

#[test]
fn test_approved_arbiters_registry() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    escrow_client.initialize(&admin, &None);

    let arbiter1 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);
    let arbiter3 = Address::generate(&env);

    let mut arbiters = Vec::new(&env);
    arbiters.push_back(arbiter1.clone());
    arbiters.push_back(arbiter2.clone());

    escrow_client.set_approved_arbiters(&arbiters);
    let list = escrow_client.get_approved_arbiters();
    assert_eq!(list.len(), 2);

    escrow_client.add_approved_arbiter(&arbiter3);
    let list2 = escrow_client.get_approved_arbiters();
    assert_eq!(list2.len(), 3);

    escrow_client.remove_approved_arbiter(&arbiter1);
    let list3 = escrow_client.get_approved_arbiters();
    assert_eq!(list3.len(), 2);
}

#[test]
fn test_multisig_dispute_resolution_2_of_3() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter1 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);
    let arbiter3 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let mut arbiters = Vec::new(&env);
    arbiters.push_back(arbiter1.clone());
    arbiters.push_back(arbiter2.clone());
    arbiters.push_back(arbiter3.clone());

    let p_id = escrow_client.create_project_multisig(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiters,
        &token_contract,
        &amounts,
        &false,
    );

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.arbiters.len(), 3);

    // Client raises dispute
    escrow_client.raise_dispute(&client_addr, &p_id);

    // Arbiter 1 and Arbiter 2 reach 2-of-3 threshold consensus to split 400 client / 600 freelancer
    escrow_client.resolve_dispute_multisig(&p_id, &arbiter1, &arbiter2, &400, &600, &None);

    assert_eq!(token_client.balance(&client_addr), 400);
    assert_eq!(token_client.balance(&freelancer_addr), 600);
    assert_eq!(token_client.balance(&contract_id), 0);

    let proj_after = escrow_client.get_project(&p_id);
    assert_eq!(proj_after.state, ProjectState::Completed);
    assert_eq!(proj_after.remaining_amount, 0);
}

#[test]
#[should_panic(expected = "Multisig threshold enabled for project")]
fn test_single_arbiter_cannot_resolve_multisig_project() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter1 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let mut arbiters = Vec::new(&env);
    arbiters.push_back(arbiter1);
    arbiters.push_back(arbiter2);

    let p_id = escrow_client.create_project_multisig(
        &client_addr,
        &Some(freelancer_addr),
        &arbiters,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&client_addr, &p_id);

    // Single arbiter calling legacy resolve_dispute must fail
    escrow_client.resolve_dispute(&p_id, &500, &500, &None);
}

#[test]
#[should_panic(expected = "Arbiters must be distinct")]
fn test_multisig_dispute_same_arbiter_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter1 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let mut arbiters = Vec::new(&env);
    arbiters.push_back(arbiter1.clone());
    arbiters.push_back(arbiter2);

    let p_id = escrow_client.create_project_multisig(
        &client_addr,
        &Some(freelancer_addr),
        &arbiters,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&client_addr, &p_id);

    // Passing the same arbiter twice must panic
    escrow_client.resolve_dispute_multisig(&p_id, &arbiter1, &arbiter1, &500, &500, &None);
}

#[test]
fn test_asynchronous_dispute_ruling_voting() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter1 = Address::generate(&env);
    let arbiter2 = Address::generate(&env);
    let arbiter3 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let mut arbiters = Vec::new(&env);
    arbiters.push_back(arbiter1.clone());
    arbiters.push_back(arbiter2.clone());
    arbiters.push_back(arbiter3);

    let p_id = escrow_client.create_project_multisig(
        &client_addr,
        &Some(freelancer_addr.clone()),
        &arbiters,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&freelancer_addr, &p_id);

    // Arbiter 1 votes (300 to client, 700 to freelancer)
    let resolved_first = escrow_client.submit_dispute_ruling(&arbiter1, &p_id, &300, &700, &None);
    assert_eq!(resolved_first, false);

    let proposal = escrow_client.get_dispute_proposal(&p_id).unwrap();
    assert_eq!(proposal.client_amount, 300);
    assert_eq!(proposal.freelancer_amount, 700);
    assert_eq!(proposal.votes.len(), 1);

    // Arbiter 2 votes for the same ruling -> threshold 2 reached, dispute resolved!
    let resolved_second = escrow_client.submit_dispute_ruling(&arbiter2, &p_id, &300, &700, &None);
    assert_eq!(resolved_second, true);

    assert_eq!(token_client.balance(&client_addr), 300);
    assert_eq!(token_client.balance(&freelancer_addr), 700);

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.state, ProjectState::Completed);
}

#[test]
fn test_dispute_14_day_timeout_refund_50_50() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Raise dispute at timestamp 1_000_000
    escrow_client.raise_dispute(&client_addr, &p_id);

    // Advance 14 days + 1 second (14 * 86_400 = 1_209_600s)
    env.ledger().set_timestamp(1_000_000 + 1_209_601);

    // Arbiter was inactive: claim 50/50 refund split
    escrow_client.resolve_dispute_timeout(&p_id, &true, &None);

    assert_eq!(token_client.balance(&client_addr), 500);
    assert_eq!(token_client.balance(&freelancer_addr), 500);
    assert_eq!(token_client.balance(&contract_id), 0);

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.state, ProjectState::Completed);
    assert_eq!(proj.remaining_amount, 0);
}

#[test]
fn test_dispute_14_day_timeout_default_client_refund() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    let token_client = token::Client::new(&env, &token_contract);

    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&freelancer_addr, &p_id);

    // Advance 14 days + 10 seconds
    env.ledger().set_timestamp(1_000_000 + 1_209_610);

    // Arbiter was inactive: default to 100% client refund
    escrow_client.resolve_dispute_timeout(&p_id, &false, &None);

    assert_eq!(token_client.balance(&client_addr), 1000);
    assert_eq!(token_client.balance(&freelancer_addr), 0);

    let proj = escrow_client.get_project(&p_id);
    assert_eq!(proj.state, ProjectState::Completed);
}

#[test]
#[should_panic(expected = "14-day arbiter inactivity window has not elapsed")]
fn test_dispute_timeout_before_14_days_fails() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register_contract(None, TrustPayEscrow);
    let escrow_client = TrustPayEscrowClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let arbiter_addr = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract);
    token_admin_client.mint(&client_addr, &1000);

    let mut amounts = Vec::new(&env);
    amounts.push_back(1000);

    let p_id = escrow_client.lock_escrow(
        &client_addr,
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.raise_dispute(&client_addr, &p_id);

    // Advance only 10 days (10 * 86_400 = 864_000s)
    env.ledger().set_timestamp(1_000_000 + 864_000);

    // Must panic because 14 days have not elapsed
    escrow_client.resolve_dispute_timeout(&p_id, &true, &None);
}

