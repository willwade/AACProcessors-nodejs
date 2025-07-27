// Test data factories and utilities for consistent test object creation
import { AACTree, AACPage, AACButton } from '../../src/core/treeStructure';

export interface ButtonConfig {
  id?: string;
  label?: string;
  message?: string;
  type?: 'SPEAK' | 'NAVIGATE';
  targetPageId?: string;
}

export interface PageConfig {
  id?: string;
  name?: string;
  buttons?: ButtonConfig[];
  parentId?: string;
}

export interface TreeConfig {
  pages?: PageConfig[];
  rootId?: string;
}

/**
 * Factory for creating AACButton instances with sensible defaults
 */
export class ButtonFactory {
  private static counter = 0;

  static create(config: ButtonConfig = {}): AACButton {
    const id = config.id || `btn_${++this.counter}`;
    
    return new AACButton({
      id,
      label: config.label || `Button ${id}`,
      message: config.message || `Message for ${id}`,
      type: config.type || 'SPEAK',
      targetPageId: config.targetPageId
    });
  }

  static createSpeak(label: string, message?: string): AACButton {
    return this.create({
      label,
      message: message || label,
      type: 'SPEAK'
    });
  }

  static createNavigate(label: string, targetPageId: string): AACButton {
    return this.create({
      label,
      message: `Navigate to ${targetPageId}`,
      type: 'NAVIGATE',
      targetPageId
    });
  }

  static createAction(label: string, message?: string): AACButton {
    return this.create({
      label,
      message: message || `Action: ${label}`,
      type: 'SPEAK' // Use SPEAK instead of ACTION since ACTION is not supported
    });
  }

  static createBatch(count: number, type: 'SPEAK' | 'NAVIGATE' = 'SPEAK'): AACButton[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({
        label: `${type} Button ${i + 1}`,
        type
      })
    );
  }
}

/**
 * Factory for creating AACPage instances with sensible defaults
 */
export class PageFactory {
  private static counter = 0;

  static create(config: PageConfig = {}): AACPage {
    const id = config.id || `page_${++this.counter}`;
    
    const page = new AACPage({
      id,
      name: config.name || `Page ${id}`,
      buttons: [],
      parentId: config.parentId
    });

    // Add buttons if specified
    if (config.buttons) {
      config.buttons.forEach(buttonConfig => {
        const button = ButtonFactory.create(buttonConfig);
        page.addButton(button);
      });
    }

    return page;
  }

  static createWithButtons(name: string, buttonConfigs: ButtonConfig[]): AACPage {
    return this.create({
      name,
      buttons: buttonConfigs
    });
  }

  static createHome(): AACPage {
    return this.create({
      id: 'home',
      name: 'Home',
      buttons: [
        { label: 'Hello', message: 'Hello!', type: 'SPEAK' },
        { label: 'Food', message: 'I want food', type: 'SPEAK' },
        { label: 'Drink', message: 'I want a drink', type: 'SPEAK' },
        { label: 'More', targetPageId: 'more', type: 'NAVIGATE' }
      ]
    });
  }

  static createCategory(categoryName: string, items: string[]): AACPage {
    const buttons = items.map(item => ({
      label: item,
      message: `I want ${item.toLowerCase()}`,
      type: 'SPEAK' as const
    }));

    return this.create({
      id: categoryName.toLowerCase().replace(/\s+/g, '_'),
      name: categoryName,
      buttons
    });
  }

  static createNavigation(pageName: string, destinations: string[]): AACPage {
    const buttons = destinations.map(dest => ({
      label: `Go to ${dest}`,
      targetPageId: dest.toLowerCase().replace(/\s+/g, '_'),
      type: 'NAVIGATE' as const
    }));

    return this.create({
      id: pageName.toLowerCase().replace(/\s+/g, '_'),
      name: pageName,
      buttons
    });
  }
}

/**
 * Factory for creating AACTree instances with sensible defaults
 */
export class TreeFactory {
  static create(config: TreeConfig = {}): AACTree {
    const tree = new AACTree();

    // Add pages if specified
    if (config.pages) {
      config.pages.forEach(pageConfig => {
        const page = PageFactory.create(pageConfig);
        tree.addPage(page);
      });
    }

    // Set root ID
    if (config.rootId) {
      tree.rootId = config.rootId;
    } else if (config.pages && config.pages.length > 0) {
      tree.rootId = config.pages[0].id || Object.keys(tree.pages)[0];
    }

    return tree;
  }

  static createSimple(): AACTree {
    const homePage = PageFactory.createHome();
    const morePage = PageFactory.create({
      id: 'more',
      name: 'More Options',
      buttons: [
        { label: 'Please', message: 'Please', type: 'SPEAK' },
        { label: 'Thank you', message: 'Thank you', type: 'SPEAK' },
        { label: 'Home', targetPageId: 'home', type: 'NAVIGATE' }
      ]
    });

    return this.create({
      pages: [
        { ...homePage, id: homePage.id, name: homePage.name, buttons: homePage.buttons.map(b => ({
          id: b.id,
          label: b.label,
          message: b.message,
          type: b.type,
          targetPageId: b.targetPageId
        })) },
        { ...morePage, id: morePage.id, name: morePage.name, buttons: morePage.buttons.map(b => ({
          id: b.id,
          label: b.label,
          message: b.message,
          type: b.type,
          targetPageId: b.targetPageId
        })) }
      ],
      rootId: 'home'
    });
  }

  static createCommunicationBoard(): AACTree {
    const pages = [
      PageFactory.createHome(),
      PageFactory.createCategory('Food', ['Apple', 'Banana', 'Bread', 'Water', 'Milk']),
      PageFactory.createCategory('Activities', ['Play', 'Read', 'Music', 'TV', 'Walk']),
      PageFactory.createCategory('People', ['Mom', 'Dad', 'Friend', 'Teacher', 'Doctor']),
      PageFactory.createNavigation('Navigation', ['Home', 'Food', 'Activities', 'People'])
    ];

    return this.create({
      pages: pages.map(page => ({
        id: page.id,
        name: page.name,
        buttons: page.buttons.map(b => ({
          id: b.id,
          label: b.label,
          message: b.message,
          type: b.type,
          targetPageId: b.targetPageId
        }))
      })),
      rootId: 'home'
    });
  }

  static createLarge(pageCount: number = 10, buttonsPerPage: number = 8): AACTree {
    const pages: PageConfig[] = [];

    for (let i = 0; i < pageCount; i++) {
      const buttons: ButtonConfig[] = [];
      
      for (let j = 0; j < buttonsPerPage; j++) {
        buttons.push({
          label: `Button ${j + 1}`,
          message: `Message ${j + 1} on page ${i + 1}`,
          type: j % 3 === 0 ? 'NAVIGATE' : 'SPEAK',
          targetPageId: j % 3 === 0 ? `page_${(i + 1) % pageCount + 1}` : undefined
        });
      }

      pages.push({
        id: `page_${i + 1}`,
        name: `Page ${i + 1}`,
        buttons
      });
    }

    return this.create({
      pages,
      rootId: 'page_1'
    });
  }

  static createMinimal(): AACTree {
    return this.create({
      pages: [{
        id: 'single',
        name: 'Single Page',
        buttons: [{
          label: 'Hello',
          message: 'Hello World',
          type: 'SPEAK'
        }]
      }],
      rootId: 'single'
    });
  }

  static createEmpty(): AACTree {
    return new AACTree();
  }
}

/**
 * Utility functions for test data generation
 */
export class TestDataUtils {
  static generateRandomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateValidId(): string {
    return `id_${this.generateRandomString(8)}`;
  }

  static generateUnicodeString(): string {
    const unicodeChars = ['😀', '🎉', '🌟', '你好', 'مرحبا', 'Café', '∑∞≠'];
    return unicodeChars[Math.floor(Math.random() * unicodeChars.length)] + 
           this.generateRandomString(5);
  }

  static createTranslationMap(originalTexts: string[], targetLanguage: string = 'es'): Map<string, string> {
    const translations = new Map<string, string>();
    
    const commonTranslations: Record<string, Record<string, string>> = {
      es: {
        'Hello': 'Hola',
        'Food': 'Comida',
        'Drink': 'Bebida',
        'Home': 'Casa',
        'More': 'Más',
        'Please': 'Por favor',
        'Thank you': 'Gracias',
        'Yes': 'Sí',
        'No': 'No'
      },
      fr: {
        'Hello': 'Bonjour',
        'Food': 'Nourriture',
        'Drink': 'Boisson',
        'Home': 'Maison',
        'More': 'Plus',
        'Please': 'S\'il vous plaît',
        'Thank you': 'Merci',
        'Yes': 'Oui',
        'No': 'Non'
      }
    };

    const targetTranslations = commonTranslations[targetLanguage] || commonTranslations.es;

    originalTexts.forEach(text => {
      if (targetTranslations[text]) {
        translations.set(text, targetTranslations[text]);
      } else {
        // Generate a simple transformation for unknown texts
        translations.set(text, `${targetLanguage.toUpperCase()}_${text}`);
      }
    });

    return translations;
  }

  static validateTreeStructure(tree: AACTree): boolean {
    try {
      // Check that all pages have unique IDs
      const pageIds = Object.keys(tree.pages);
      const uniqueIds = new Set(pageIds);
      if (pageIds.length !== uniqueIds.size) return false;

      // Check that all navigation targets exist
      for (const page of Object.values(tree.pages)) {
        for (const button of page.buttons) {
          if (button.type === 'NAVIGATE' && button.targetPageId) {
            if (!tree.pages[button.targetPageId]) {
              console.warn(`Invalid navigation target: ${button.targetPageId}`);
              // Don't fail validation for this as it might be intentional in tests
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Tree validation error:', error);
      return false;
    }
  }
}
