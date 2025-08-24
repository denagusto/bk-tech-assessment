describe('Flash Sale System - Core Flow Test', () => {
  const testUser = 'john_doe';

  beforeEach(() => {
    cy.visit('/');
    
    // Reset system to ensure clean state for each test
    cy.log('Resetting system to clean state...');
    cy.resetSystem();
    cy.log('System reset completed');
  });

  it('should test purchase flow with available stock', () => {
    cy.log('=== CORE PURCHASE FLOW TEST ===');
    
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check current stock status
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      cy.log(`Current stock: ${currentStock}`);
      
      if (currentStock > 0) {
        // Test purchase with john_doe using custom command
        cy.attemptPurchase('john_doe');
        cy.verifyPurchaseResult('successful');
        cy.log('Purchase successful');
        
        // Verify stock decreased using custom command
        cy.verifyStockValue(currentStock - 1);
        cy.log(`Stock decreased from ${currentStock} to ${currentStock - 1}`);
        
        // Test duplicate purchase prevention
        cy.attemptPurchase('john_doe');
        cy.verifyPurchaseResult('already purchased');
        cy.log('Duplicate purchase blocked');
        
      } else {
        cy.log('No stock available, verifying sold-out status');
        cy.verifyStockValue(0);
        cy.get('[data-testid="sold-stock"]').should('contain', '5');
        cy.get('[data-testid="status-text"]').should('contain', 'Sold Out');
        cy.log('System correctly shows sold-out status');
      }
    });
  });

  it('should test purchase flow with pre-reset system', () => {
    cy.log('=== SIMPLIFIED PURCHASE FLOW TEST ===');
    
    // This test assumes the system is already reset and has 5 stock items
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check if stock is available
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      
      if (currentStock > 0) {
        cy.log(`Current stock: ${currentStock}`);
        
        // Test purchase with john_doe using custom command
        cy.attemptPurchase('john_doe');
        cy.verifyPurchaseResult('successful');
        cy.log('Purchase successful');
        
        // Verify stock decreased using custom command
        cy.verifyStockValue(currentStock - 1);
        cy.log('Stock decreased correctly');
      } else {
        cy.log('No stock available, skipping purchase test');
        cy.verifyStockValue(0);
      }
    });
  });

  it('should demonstrate stock depletion scenario', () => {
    cy.log('=== STOCK DEPLETION DEMONSTRATION ===');
    
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check current stock
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      cy.log(`Current stock: ${currentStock}`);
      
      if (currentStock > 0) {
        // Make purchases until stock is depleted
        const users = ['john_doe', 'jane_smith', 'alice_brown', 'diana_miller', 'edward_garcia'];
        const maxPurchases = Math.min(currentStock, users.length);
        
        cy.log(`Will attempt ${maxPurchases} purchases`);
        
        for (let i = 0; i < maxPurchases; i++) {
          const user = users[i];
          cy.log(`Purchase ${i + 1}: ${user}`);
          
                    cy.attemptPurchase(user);
          cy.verifyPurchaseResult('successful');
          cy.log(`${user} purchased successfully`);
          
          // Wait a bit for the UI to update
          cy.wait(500);
        }
        
        // Verify final stock using custom command
        cy.verifyStockValue(0);
        cy.log('Stock successfully depleted to 0');
        
        // Verify sold-out status
        cy.get('[data-testid="status-text"]').should('contain', 'Sold Out');
        cy.log('System correctly shows sold-out status');
        
      } else {
        cy.log('Stock already depleted, verifying sold-out status');
        cy.verifyStockValue(0);
        cy.get('[data-testid="sold-stock"]').should('contain', '5');
        cy.get('[data-testid="status-text"]').should('contain', 'Sold Out');
        cy.log('System correctly shows sold-out status');
      }
    });
  });
});
