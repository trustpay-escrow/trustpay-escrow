#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env, Vec};
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
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    assert_eq!(project_id, 1);

    let project = client.get_project(&project_id);
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
            &freelancer_addr,
            &arbiter_addr,
            &token_contract,
            &amounts,
            &false,
        );

        assert_eq!(p_id, (idx as u64) + 1);

        // Submit and approve first milestone
        escrow_client.submit_milestone(&p_id, &0);
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
        &freelancer_addr,
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
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &true,
    );

    // Simulate interest earned from Blend (100 tokens of yield minted to contract)
    token_admin_client.mint(&contract_id, &100);
    escrow_client.accrue_yield(&arbiter_addr, &p_id, &100);

    // Submit and approve milestone
    escrow_client.submit_milestone(&p_id, &0);
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
        &freelancer_addr,
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
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    // Freelancer submits milestone 0 at timestamp 1_000_000
    escrow_client.submit_milestone(&p_id, &0);
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
        &freelancer_addr,
        &arbiter_addr,
        &token_contract,
        &amounts,
        &false,
    );

    escrow_client.submit_milestone(&p_id, &0);

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
        &freelancer_addr,
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
        &freelancer_addr,
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

    let p1 = escrow_client.create_project(&client1, &freelancer1, &arbiter1, &token_contract, &amounts1, &false);
    let _p2 = escrow_client.create_project(&client2, &freelancer2, &arbiter2, &token_contract, &amounts2, &false);

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
        &freelancer_addr,
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
        &freelancer_addr,
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

