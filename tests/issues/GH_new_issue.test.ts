import { Entity, JsonType, MikroORM, PrimaryKey, Property, wrap } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';

type UnitOfMeasure = 'pcs' | 'gram';

interface Ingredient {
  name: string;
  quantity: {
    units: number;
    uom: UnitOfMeasure;
  };
}

enum CookingDevice {
  OVEN = 'Oven',
  MICRO = 'Microwave'
}

export type CookingInstructions = {
  [device in CookingDevice]?: {
    degrees: number;
    time: number;
  }
};

interface Instructions {
  ingredients: Ingredient[];
  cooking: CookingInstructions;
  notes?: string;
}

@Entity()
export class Recipe {

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ type: JsonType })
  instructions!: Instructions;

}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    entities: [Recipe],
    dbName: ':memory:',
    driver: BetterSqliteDriver,
  });
  await orm.schema.createSchema();
});

afterAll(async () => {
  await orm.close(true);
});

test(`GH issue updating nested props`, async () => {
  const e = orm.em.create(Recipe, {
    id: 1,
    name: 'Pizza',
    instructions: {
      ingredients: [
        {
          name: 'Tomato',
          quantity: {
            units: 1,
            uom: 'pcs',
          },
        },
        {
          name: 'Salami',
          quantity: {
            units: 2,
            uom: 'pcs',
          },
        },
        {
          name: 'Cheese',
          quantity: {
            units: 1,
            uom: 'pcs',
          },
        },
      ],
      cooking: {
        Oven : {
          degrees: 200,
          time: 12,
        },
        Microwave: {
          degrees: 180,
          time: 15,
        },
      },
      notes: 'do not cook it too long',
    },
  });
  await orm.em.persistAndFlush(e);

  const e1 = await orm.em.findOneOrFail(Recipe, 1);
  const updatedRecipe: Recipe = {
    id: 1,
    name: 'Pizza',
    instructions: {
      ingredients: [
        {
          name: 'Tomato',
          quantity: {
            units: 1,
            uom: 'pcs',
          },
        },
        {
          name: 'Salami',
          quantity: {
            units: 2,
            uom: 'pcs',
          },
        },
        {
          name: 'Cheese',
          quantity: {
            units: 100,
            uom: 'gram',
          },
        },
      ],
      cooking: {
        Oven : {
          degrees: 200,
          time: 12,
        },
        // when passing undefined object the test will fail, the cooking object will not be updated
        // only omitting the object or passing null works
        // Microwave: undefined,
      },
      // test only succeeds when providing null, or omitting the next prop
      notes: undefined,
    },
  };
  wrap(e1).assign(updatedRecipe);

  await orm.em.flush();

  const reloadedRecipe = await orm.em.fork().findOneOrFail(Recipe, 1);
  const finalRecipe = wrap(reloadedRecipe).toObject();

  expect(finalRecipe).toMatchObject(updatedRecipe);
});
