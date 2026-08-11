#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Vec};
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
    escrow_client.accrue_yield(&p_id, &100);

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
    escrow_client.accrue_yield(&p_id, &50);

    // Resolve dispute: 400 to client, 600 to freelancer
    escrow_client.resolve_dispute(&p_id, &400, &600, &Some(platform_addr.clone()));

    // Freelancer gets 600
    assert_eq!(token_client.balance(&freelancer_addr), 600);

    // Client gets 400 principal + 70% of 50 yield (35) = 435 total
    assert_eq!(token_client.balance(&client_addr), 435);

    // Platform gets 30% of 50 yield (15)
    assert_eq!(token_client.balance(&platform_addr), 15);
}


