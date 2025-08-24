import './commands';

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to wait for flash sale status to be loaded
       */
      waitForFlashSaleStatus(): Chainable<Element>;
      
      /**
       * Custom command to attempt a purchase
       */
      attemptPurchase(userId: string): Chainable<Element>;
      
      /**
       * Custom command to check user purchase status
       */
      checkUserPurchase(userId: string): Chainable<Element>;
      
      /**
       * Custom command to reset the system
       */
      resetSystem(): Chainable<Element>;
      
      /**
       * Custom command to navigate to users tab
       */
      navigateToUsersTab(): Chainable<Element>;
      
      /**
       * Custom command to wait for API response
       */
      waitForApiResponse(alias: string, timeout?: number): Chainable<Element>;
      
      /**
       * Custom command to verify stock value
       */
      verifyStockValue(expectedStock: number): Chainable<Element>;
      
      /**
       * Custom command to navigate to main tab
       */
      navigateToMainTab(): Chainable<Element>;
      
      /**
       * Custom command to verify purchase result
       */
      verifyPurchaseResult(expectedMessage: string): Chainable<Element>;
      
      /**
       * Custom command to verify user purchase status
       */
      verifyUserPurchaseStatus(expectedStatus: string): Chainable<Element>;
    }
  }
}
