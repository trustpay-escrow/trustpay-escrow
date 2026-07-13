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
