Cypress.Commands.add('waitForFlashSaleStatus', () => {
  cy.get('[data-testid="flash-sale-status"]', { timeout: 10000 }).should('be.visible');
});

Cypress.Commands.add('attemptPurchase', (userId: string) => {
  cy.get('[data-testid="user-id-input"]').clear().type(userId);
  cy.get('[data-testid="buy-now-button"]').click();
  cy.get('[data-testid="purchase-result"]', { timeout: 10000 }).should('be.visible');
});

Cypress.Commands.add('checkUserPurchase', (userId: string) => {
  cy.get('[data-testid="user-id-input"]').clear().type(userId);
  cy.get('[data-testid="check-purchase-button"]').click();
  cy.get('[data-testid="user-purchase-status"]', { timeout: 10000 }).should('be.visible');
});

Cypress.Commands.add('resetSystem', () => {
  // Navigate to users tab
  cy.get('[data-testid="users-tab"]').click();
  
  // Click reset system button (using the small stock reset button)
  cy.get('[data-testid="reset-system-button-small"]').click();
  
  // Wait for reset to complete
  cy.get('[data-testid="reset-message"]', { timeout: 15000 }).should('be.visible');
});

Cypress.Commands.add('navigateToUsersTab', () => {
  cy.get('[data-testid="users-tab"]').click();
  cy.get('[data-testid="users-section"]').should('be.visible');
});

Cypress.Commands.add('waitForApiResponse', (alias: string, timeout: number = 10000) => {
  cy.wait(alias, { timeout });
});

Cypress.Commands.add('verifyStockValue', (expectedStock: number) => {
  cy.get('[data-testid="current-stock"]').should('contain', expectedStock.toString());
});

Cypress.Commands.add('navigateToMainTab', () => {
  cy.get('[data-testid="main-tab"]').click();
  cy.get('[data-testid="main-tab-content"]').should('be.visible');
});

Cypress.Commands.add('verifyPurchaseResult', (expectedMessage: string) => {
  cy.get('[data-testid="purchase-result"]').should('contain', expectedMessage);
});

Cypress.Commands.add('verifyUserPurchaseStatus', (expectedStatus: string) => {
  cy.get('[data-testid="user-purchase-status"]').should('contain', expectedStatus);
});
