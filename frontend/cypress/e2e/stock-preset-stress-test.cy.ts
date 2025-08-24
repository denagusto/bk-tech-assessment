// Interface for purchase results
interface PurchaseResult {
  username: string;
  success: boolean;
  message: string;
  purchaseId?: string;
  statusCode?: number;
  timestamp: string;
}

describe('Flash Sale System - Stock Preset Stress Tests', () => {
  const TIMEOUT = 30000; // 30 seconds timeout for stress test

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
      cy.log('Small stock preset applied successfully');
    });
    
    // Also seed users to ensure fresh state
    cy.request({
      method: 'POST',
      url: `${Cypress.env('backendUrl')}/api/users/seed`,
      timeout: 10000
    }).then((response) => {
      cy.log('Users seeded successfully');
    });
    
    // Wait a bit for the system to stabilize
    cy.wait(2000);
    
    cy.log('Small stock preset (5 items) applied successfully');
  });

  it('should handle stress test with Small (5) stock preset', () => {
    cy.log('=== STRESS TEST: Small Stock Preset (5 items) ===');
    
    // Step 1: Navigate to Setting Presets tab and set stock to Small (5)
    cy.log('Step 1: Setting stock preset to Small (5 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-small"]').click();
    cy.wait(2000); // Wait for preset to apply
    
    // Step 2: Verify initial stock is 5 (preset applied)
    cy.log('Step 2: Verifying initial stock is 5 items');
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '5');
    cy.log('Initial stock verified: 5 items');
    
    // Step 3: Get users from API instead of hardcoded list
    cy.log('Step 3: Fetching users from API with pagination handling');
    
    // Function to fetch all users across multiple pages
    const fetchAllUsers = (targetCount: number) => {
      let allUsers: string[] = [];
      let page = 1;
      const pageSize = 50; // Use larger page size for efficiency
      
      const fetchNextPage = () => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('backendUrl')}/api/users?page=${page}&limit=${pageSize}`,
          timeout: 10000
        }).then((response) => {
          const users = response.body.users || response.body;
          cy.log(`Page ${page}: Fetched ${users.length} users`);
          
          if (users && users.length > 0) {
            // Filter users with canPurchase: true
            const purchasableUsers = users.filter((user: any) => user.canPurchase === true);
            const usernames = purchasableUsers.map((user: any) => user.username);
            cy.log(`Page ${page}: ${purchasableUsers.length} users can purchase out of ${users.length} total`);
            
            allUsers = allUsers.concat(usernames);
            cy.log(`Total purchasable users collected so far: ${allUsers.length}`);
            
            // If we have enough users or this page is smaller than pageSize, we're done
            if (allUsers.length >= targetCount || users.length < pageSize) {
              cy.log(`User collection complete. Total purchasable users: ${allUsers.length}`);
              executeStockPresetTest(allUsers.slice(0, targetCount));
              return;
            }
            
            // Fetch next page
            page++;
            fetchNextPage();
          } else {
            cy.log('No more users found, proceeding with available purchasable users');
            executeStockPresetTest(allUsers.slice(0, targetCount));
          }
        });
      };
      
      fetchNextPage();
    };
    
    // Start fetching users
    fetchAllUsers(3);
    
    // Helper function to execute the stock preset test
    const executeStockPresetTest = (testUsers: string[]) => {
      cy.log(`Testing with ${testUsers.length} purchasable users against 5 stock items`);
      cy.log('Note: Testing 3 users against 5 stock (leaving 2 stock remaining)');
      
      let successfulCount = 0;
      let failedCount = 0;
      
      // Process users sequentially
      testUsers.forEach((username, index) => {
        cy.log(`Processing user ${index + 1}: ${username}`);
        
        cy.request({
          method: 'POST',
          url: `${Cypress.env('backendUrl')}/api/flash-sale/purchase`,
          body: { userIdentifier: username },
          headers: { 'Content-Type': 'application/json' },
          timeout: TIMEOUT
        }).then((response) => {
          if (response.body.success) {
            successfulCount++;
            cy.log(`${username} purchased successfully (${successfulCount}/3)`);
          } else {
            failedCount++;
            cy.log(`${username} failed: ${response.body.message}`);
          }
        });
        
        // Small delay between requests
        if (index < testUsers.length - 1) {
          cy.wait(200);
        }
      });
      
      // Step 4: Wait for all requests to complete and verify results
      cy.wait(3000).then(() => {
        cy.log('All purchase attempts completed');
        
        // Verify exactly 3 successful purchases (since we only tested 3 users)
        expect(successfulCount).to.equal(3);
        expect(failedCount).to.equal(0);
        
        // Verify final stock is 2 (5 - 3) - stock preset remains at 5
        cy.get('[data-testid="current-stock"]').should('contain', '2');
        cy.get('[data-testid="sold-stock"]').should('contain', '3');
        cy.get('[data-testid="total-stock"]').should('contain', '5');
        
        cy.log('Small stock preset stress test passed!');
        cy.log('Summary: 3 users tested against 5 stock items');
        cy.log('Result: 3 purchases succeeded, 2 stock remaining');
        cy.log('Stock preset remains at 5 items (as intended)');
      });
    };
  });

  it('should handle stress test with Medium (100) stock preset', () => {
    cy.log('=== STRESS TEST: Medium Stock Preset (100 items) ===');
    
    // Step 1: Navigate to Setting Presets tab and set stock to Medium (100)
    cy.log('Step 1: Setting stock preset to Medium (100 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-medium"]').click();
    cy.wait(2000); // Wait for preset to apply
    
    // Step 2: Verify initial stock is 100 (preset applied)
    cy.log('Step 2: Verifying initial stock is 100 items');
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '100');
    cy.log('Initial stock verified: 100 items');
    
    // Step 3: Get users from API instead of hardcoded list
    cy.log('Step 3: Fetching users from API with pagination handling');
    
    // Function to fetch all users across multiple pages
    const fetchAllUsers = (targetCount: number) => {
      let allUsers: string[] = [];
      let page = 1;
      const pageSize = 50; // Use larger page size for efficiency
      
      const fetchNextPage = () => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('backendUrl')}/api/users?page=${page}&limit=${pageSize}`,
          timeout: 10000
        }).then((response) => {
          const users = response.body.users || response.body;
          cy.log(`Page ${page}: Fetched ${users.length} users`);
          
          if (users && users.length > 0) {
            // Filter users with canPurchase: true
            const purchasableUsers = users.filter((user: any) => user.canPurchase === true);
            const usernames = purchasableUsers.map((user: any) => user.username);
            cy.log(`Page ${page}: ${purchasableUsers.length} users can purchase out of ${users.length} total`);
            
            allUsers = allUsers.concat(usernames);
            cy.log(`Total purchasable users collected so far: ${allUsers.length}`);
            
            // If we have enough users or this page is smaller than pageSize, we're done
            if (allUsers.length >= targetCount || users.length < pageSize) {
              cy.log(`User collection complete. Total purchasable users: ${allUsers.length}`);
              executeMediumStockTest(allUsers.slice(0, targetCount));
              return;
            }
            
            // Fetch next page
            page++;
            fetchNextPage();
          } else {
            cy.log('No more users found, proceeding with available purchasable users');
            executeMediumStockTest(allUsers.slice(0, targetCount));
          }
        });
      };
      
      fetchNextPage();
    };
    
    // Start fetching users
    fetchAllUsers(80);
    
    // Helper function to execute the medium stock test
    const executeMediumStockTest = (testUsers: string[]) => {
      cy.log(`Testing with ${testUsers.length} purchasable users against 100 stock items`);
      cy.log('Note: Testing 80 users against 100 stock (leaving 20 stock remaining)');
      
      let successfulCount = 0;
      let failedCount = 0;
      
      // Process users sequentially
      testUsers.forEach((username, index) => {
        cy.log(`Processing user ${index + 1}: ${username}`);
        
        cy.request({
          method: 'POST',
          url: `${Cypress.env('backendUrl')}/api/flash-sale/purchase`,
          body: { userIdentifier: username },
          headers: { 'Content-Type': 'application/json' },
          timeout: TIMEOUT
        }).then((response) => {
          if (response.body.success) {
            successfulCount++;
            cy.log(`${username} purchased successfully (${successfulCount}/80)`);
          } else {
            failedCount++;
            cy.log(`${username} failed: ${response.body.message}`);
          }
        });
        
        // Small delay between requests
        if (index < testUsers.length - 1) {
          cy.wait(100);
        }
      });
      
      // Step 4: Wait for all requests to complete and verify results
      cy.wait(5000).then(() => {
        cy.log('All purchase attempts completed');
        
        // Verify exactly 80 successful purchases (since we only tested 80 users)
        expect(successfulCount).to.equal(80);
        expect(failedCount).to.equal(0);
        
        // Verify final stock is 20 (100 - 80) - stock preset remains at 100
        cy.get('[data-testid="current-stock"]').should('contain', '20');
        cy.get('[data-testid="sold-stock"]').should('contain', '80');
        cy.get('[data-testid="total-stock"]').should('contain', '100');
        
        cy.log('Medium stock preset stress test passed!');
        cy.log('Summary: 80 users tested against 100 stock items');
        cy.log('Result: 80 purchases succeeded, 20 stock remaining');
        cy.log('Stock preset remains at 100 items (as intended)');
      });
    };
  });

  it('should handle stress test with Large (1000) stock preset', () => {
    cy.log('=== STRESS TEST: Large Stock Preset (1000 items) ===');
    
    // Step 1: Navigate to Setting Presets tab and set stock to Large (1000)
    cy.log('Step 1: Setting stock preset to Large (1000 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-large"]').click();
    cy.wait(2000); // Wait for preset to apply
    
    // Step 2: Verify initial stock is 1000 (preset applied)
    cy.log('Step 2: Verifying initial stock is 1000 items');
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '1000');
    cy.log('Initial stock verified: 1000 items');
    
    // Step 3: Get users from API instead of hardcoded list
    cy.log('Step 3: Fetching users from API with pagination handling');
    
    // Function to fetch all users across multiple pages
    const fetchAllUsers = (targetCount: number) => {
      let allUsers: string[] = [];
      let page = 1;
      const pageSize = 50; // Use larger page size for efficiency
      
      const fetchNextPage = () => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('backendUrl')}/api/users?page=${page}&limit=${pageSize}`,
          timeout: 10000
        }).then((response) => {
          const users = response.body.users || response.body;
          cy.log(`Page ${page}: Fetched ${users.length} users`);
          
          if (users && users.length > 0) {
            // Filter users with canPurchase: true
            const purchasableUsers = users.filter((user: any) => user.canPurchase === true);
            const usernames = purchasableUsers.map((user: any) => user.username);
            cy.log(`Page ${page}: ${purchasableUsers.length} users can purchase out of ${users.length} total`);
            
            allUsers = allUsers.concat(usernames);
            cy.log(`Total purchasable users collected so far: ${allUsers.length}`);
            
            // If we have enough users or this page is smaller than pageSize, we're done
            if (allUsers.length >= targetCount || users.length < pageSize) {
              cy.log(`User collection complete. Total purchasable users: ${allUsers.length}`);
              executeLargeStockTest(allUsers.slice(0, targetCount));
              return;
            }
            
            // Fetch next page
            page++;
            fetchNextPage();
          } else {
            cy.log('No more users found, proceeding with available purchasable users');
            executeLargeStockTest(allUsers.slice(0, targetCount));
          }
        });
      };
      
      fetchNextPage();
    };
    
    // Start fetching users (test with 200 users against 1000 stock items)
    fetchAllUsers(200);
    
    // Helper function to execute the large stock test
    const executeLargeStockTest = (testUsers: string[]) => {
      cy.log(`Testing with ${testUsers.length} purchasable users against 1000 stock items`);
      cy.log('Note: Testing 200 users against 1000 stock (leaving 800 stock remaining)');
      
      let successfulCount = 0;
      let failedCount = 0;
      
      // Process users sequentially
      testUsers.forEach((username, index) => {
        cy.log(`Processing user ${index + 1}: ${username}`);
        
        cy.request({
          method: 'POST',
          url: `${Cypress.env('backendUrl')}/api/flash-sale/purchase`,
          body: { userIdentifier: username },
          headers: { 'Content-Type': 'application/json' },
          timeout: TIMEOUT
        }).then((response) => {
          if (response.body.success) {
            successfulCount++;
            cy.log(`${username} purchased successfully (${successfulCount}/200)`);
          } else {
            failedCount++;
            cy.log(`${username} failed: ${response.body.message}`);
          }
        });
        
        // Small delay between requests
        if (index < testUsers.length - 1) {
          cy.wait(50);
        }
      });
      
      // Step 4: Wait for all requests to complete and verify results
      cy.wait(10000).then(() => {
        cy.log('All purchase attempts completed');
        
        // Verify exactly 200 successful purchases (since we only tested 200 users)
        expect(successfulCount).to.equal(200);
        expect(failedCount).to.equal(0);
        
        // Verify final stock is 800 (1000 - 200) - stock preset remains at 1000
        cy.get('[data-testid="current-stock"]').should('contain', '800');
        cy.get('[data-testid="sold-stock"]').should('contain', '200');
        cy.get('[data-testid="total-stock"]').should('contain', '1000');
        
        cy.log('Large stock preset stress test passed!');
        cy.log('Summary: 200 users tested against 1000 stock items');
        cy.log('Result: 200 purchases succeeded, 800 stock remaining');
        cy.log('Stock preset remains at 1000 items (as intended)');
      });
    };
  });

  it('should demonstrate preset switching during testing', () => {
    cy.log('=== TEST: Preset Switching During Testing ===');
    
    // Step 1: Start with Small preset
    cy.log('Step 1: Starting with Small preset (5 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-small"]').click();
    cy.wait(2000);
    
    // Step 2: Verify small stock
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '5');
    
    // Step 3: Switch to Medium preset
    cy.log('Step 3: Switching to Medium preset (100 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-medium"]').click();
    cy.wait(2000);
    
    // Step 4: Verify medium stock
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '100');
    
    // Step 5: Switch to Large preset
    cy.log('Step 5: Switching to Large preset (1000 items)');
    cy.get('[data-testid="users-tab"]').click();
    cy.get('[data-testid="preset-large"]').click();
    cy.wait(2000);
    
    // Step 6: Verify large stock
    cy.get('[data-testid="main-tab"]').click();
    cy.get('[data-testid="current-stock"]').should('contain', '1000');
    
    cy.log('Preset switching test passed!');
  });
});
