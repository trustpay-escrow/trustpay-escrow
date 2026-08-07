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
    );

    assert_eq!(project_id, 1);
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
        );

        assert_eq!(p_id, (idx as u64) + 1);

        // Submit and approve first milestone
        escrow_client.submit_milestone(&p_id, &0);
        escrow_client.approve_milestone(&p_id, &0);

        // Freelancer should have received 1000 tokens of this specific token
        assert_eq!(sac_token.balance(&freelancer_addr), 1000);
    }
}

