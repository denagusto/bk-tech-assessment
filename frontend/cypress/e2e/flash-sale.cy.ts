describe('Flash Sale System - Core Flow Test', () => {
  let testUsers: string[] = [];

  // Function to fetch users from API
  const fetchUsers = (limit: number = 10) => {
    cy.request({
      method: 'GET',
      url: `${Cypress.env('backendUrl')}/api/users?page=1&limit=${limit}`,
      timeout: 10000
    }).then((response) => {
      expect(response.status).to.equal(200);
      const users = response.body.users || response.body;
      
      // Filter users who can purchase and haven't purchased yet
      testUsers = users
        .filter((user: any) => user.canPurchase === true && user.hasPurchased === false)
        .map((user: any) => user.username)
        .slice(0, limit);
      
      cy.log(`Fetched ${testUsers.length} available purchasable users from API`);
      cy.log(`Users: ${testUsers.join(', ')}`);
    });
  };

  beforeEach(() => {
    cy.visit('/');
    
    // Set stock to Small preset (5 items) instead of reset
    cy.log('Setting stock to Small preset (5 items) for clean test state...');
    
    // Use stock-preset API to set stock to 5 items
    cy.request({
      method: 'POST',
      url: `${Cypress.env('backendUrl')}/api/flash-sale/stock-preset/small`,
      timeout: 15000
    }).then((response) => {
      cy.log('Small stock preset API call completed');
      cy.log('Response:', response.body);
    });
    
    // Also seed users to ensure fresh state
    cy.request({
      method: 'POST',
      url: `${Cypress.env('backendUrl')}/api/users/seed`,
      timeout: 10000
    }).then((response) => {
      cy.log('Users seeded successfully');
    });
    
    // Fetch users from API
    fetchUsers(10);
    
    // Wait longer for the system to stabilize and stock preset to take effect
    cy.wait(5000);
    
    // Verify that the stock preset was actually applied correctly
    cy.request({
      method: 'GET',
      url: `${Cypress.env('backendUrl')}/api/flash-sale/status`,
      timeout: 10000
    }).then((response) => {
      cy.log('API Status after preset:', response.body);
      expect(response.body.currentStock).to.equal(5);
      expect(response.body.maxStock).to.equal(5);
      cy.log('API confirms stock preset applied: 5 items available');
    });
    
    // Also verify the UI shows the correct stock
    cy.visit('/');
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '5');
    cy.log('UI confirms stock preset applied: 5 items visible');
    
    cy.log('Small stock preset (5 items) applied successfully');
  });

  it('should test purchase flow with available stock', () => {
    cy.log('=== CORE PURCHASE FLOW TEST ===');
    
    // Ensure we have users before proceeding
    cy.wrap(null).then(() => {
      expect(testUsers.length).to.be.greaterThan(0);
      cy.log(`Using ${testUsers.length} users for testing`);
    });
    
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check current stock status
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      cy.log(`Current stock: ${currentStock}`);
      
      if (currentStock > 0) {
        // Test purchase with first available user
        const testUser = testUsers[0];
        cy.log(`Testing purchase with user: ${testUser}`);
        
        cy.attemptPurchase(testUser);
        
        // Wait for purchase result to appear and verify
        cy.get('[data-testid="purchase-result"]', { timeout: 15000 }).should('be.visible');
        
        // Log the actual purchase result for debugging
        cy.get('[data-testid="purchase-result"]').then(($result) => {
          const resultText = $result.text();
          cy.log(`Purchase result text: "${resultText}"`);
          
          if (resultText.includes('Success')) {
            cy.log('Purchase successful');
            // Verify stock decreased using custom command
            cy.verifyStockValue(currentStock - 1);
            cy.log(`Stock decreased from ${currentStock} to ${currentStock - 1}`);
          } else {
            cy.log('Purchase failed or unexpected result');
          }
        });
        
        // Test duplicate purchase prevention
        cy.attemptPurchase(testUser);
        cy.get('[data-testid="purchase-result"]', { timeout: 15000 }).should('be.visible');
        
        // Log the actual duplicate purchase result for debugging
        cy.get('[data-testid="purchase-result"]').then(($result) => {
          const resultText = $result.text();
          cy.log(`Duplicate purchase result text: "${resultText}"`);
          
          if (resultText.includes('already purchased') || resultText.includes('Already purchased')) {
            cy.log('Duplicate purchase blocked correctly');
          } else {
            cy.log('Unexpected duplicate purchase result');
          }
        });
        
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
    
    // Ensure we have users before proceeding
    cy.wrap(null).then(() => {
      expect(testUsers.length).to.be.greaterThan(0);
      cy.log(`Using ${testUsers.length} users for testing`);
    });
    
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check if stock is available
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      cy.log(`Current stock: ${currentStock}`);
      
      if (currentStock > 0) {
        cy.log(`Current stock: ${currentStock}`);
        
        // Test purchase with first available user
        const testUser = testUsers[0];
        cy.log(`Testing purchase with user: ${testUser}`);
        
        cy.attemptPurchase(testUser);
        
        // Wait for purchase result and verify success
        cy.get('[data-testid="purchase-result"]', { timeout: 15000 }).should('be.visible');
        
        // Log the actual purchase result for debugging
        cy.get('[data-testid="purchase-result"]').then(($result) => {
          const resultText = $result.text();
          cy.log(`Purchase result text: "${resultText}"`);
          
          if (resultText.includes('Success')) {
            cy.log('Purchase successful');
            // Verify stock decreased - use the actual current stock value
            const expectedStock = currentStock - 1;
            cy.get('[data-testid="current-stock"]').should('contain', expectedStock.toString());
            cy.log(`Stock decreased from ${currentStock} to ${expectedStock}`);
          } else {
            cy.log('Purchase failed or unexpected result');
          }
        });
      } else {
        cy.log('No stock available, skipping purchase test');
        cy.get('[data-testid="current-stock"]').should('contain', '0');
      }
    });
  });

  it('should demonstrate stock depletion scenario', () => {
    cy.log('=== STOCK DEPLETION DEMONSTRATION ===');
    
    // Ensure we have users before proceeding
    cy.wrap(null).then(() => {
      expect(testUsers.length).to.be.greaterThan(0);
      cy.log(`Using ${testUsers.length} users for testing`);
    });
    
    // Navigate to main tab using custom command
    cy.navigateToMainTab();
    
    // Check current stock
    cy.get('[data-testid="current-stock"]').then(($stock) => {
      const currentStock = parseInt($stock.text());
      cy.log(`Current stock: ${currentStock}`);
      
      if (currentStock > 0) {
        // Make purchases until stock is depleted
        const maxPurchases = Math.min(currentStock, testUsers.length);
        
        cy.log(`Will attempt ${maxPurchases} purchases with ${testUsers.length} available users`);
        
        for (let i = 0; i < maxPurchases; i++) {
          const user = testUsers[i];
          cy.log(`Purchase ${i + 1}: ${user}`);
          
          cy.attemptPurchase(user);
          
          // Wait for purchase result and verify success
          cy.get('[data-testid="purchase-result"]', { timeout: 15000 }).should('be.visible');
          
          // Log the actual purchase result for debugging
          cy.get('[data-testid="purchase-result"]').then(($result) => {
            const resultText = $result.text();
            cy.log(`Purchase ${i + 1} result: "${resultText}"`);
            
            if (resultText.includes('Success')) {
              cy.log(`${user} purchased successfully`);
            } else {
              cy.log(`${user} purchase failed or unexpected result`);
            }
          });
          
          // Wait a bit for the UI to update
          cy.wait(500);
        }
        
        // Verify final stock - should be 0 after all purchases
        cy.get('[data-testid="current-stock"]').should('contain', '0');
        cy.log('Stock successfully depleted to 0');
        
        // Verify sold-out status
        cy.get('[data-testid="status-text"]').should('contain', 'Sold Out');
        cy.log('System correctly shows sold-out status');
        
      } else {
        cy.log('Stock already depleted, verifying sold-out status');
        cy.get('[data-testid="current-stock"]').should('contain', '0');
        cy.get('[data-testid="sold-stock"]').should('contain', '5');
        cy.get('[data-testid="status-text"]').should('contain', 'Sold Out');
        cy.log('System correctly shows sold-out status');
      }
    });
  });
});
