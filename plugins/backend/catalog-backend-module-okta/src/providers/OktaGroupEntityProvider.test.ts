/*
 * Copyright 2022 Larder Software Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { OktaGroupEntityProvider } from './OktaGroupEntityProvider';
import { ConfigReader } from '@backstage/config';
import { EntityProviderConnection } from '@backstage/plugin-catalog-backend';
import { MockOktaCollection } from '../test-utls';
import { getVoidLogger } from '@backstage/backend-common';

let listGroups: (queryParameters:any) => MockOktaCollection = () => {
  return new MockOktaCollection([]);
};

jest.mock('@okta/okta-sdk-nodejs', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        listGroups,
      };
    }),
  };
});

const logger = getVoidLogger();

describe('OktaGroupProvider', () => {
  const config = new ConfigReader({
    orgUrl: 'https://okta',
    token: 'secret',
  });

  describe('where there is no groups', () => {
    beforeEach(() => {
      listGroups = () => new MockOktaCollection([]);
    });

    it('creates no okta groups', async () => {
      const entityProviderConnection: EntityProviderConnection = {
        applyMutation: jest.fn(),
      };
      const provider = OktaGroupEntityProvider.fromConfig(config, { logger });
      provider.connect(entityProviderConnection);
      await provider.run();
      expect(entityProviderConnection.applyMutation).toBeCalledWith({
        type: 'full',
        entities: [],
      });
    });
  });

  describe('where there is a group filter', () => {
    const config = new ConfigReader({
      orgUrl: 'https://okta',
      token: 'secret',
      groups: ["group1"]
    });

    beforeEach(() => {
      listGroups = (queryParameters:any) => {

        // just ensuring we're passing in the matching group only
        const q = queryParameters.q
        expect(q).toEqual("group1")

        return new MockOktaCollection([
          {
            id: 'group1',
            profile: {
              name: 'Everyone@the-company',
              description: 'Everyone in the company',
            },
            listUsers: () => {
              return new MockOktaCollection([
                {
                  id: 'asdfwefwefwef',
                  profile: {
                    email: 'fname@domain.com',
                  },
                },
              ]);
            },
          },
        ])
      };
    });

    it('creates okta groups only for matching group', async () => {
      const entityProviderConnection: EntityProviderConnection = {
        applyMutation: jest.fn(),
      };
      const provider = OktaGroupEntityProvider.fromConfig(config, { logger });
      provider.connect(entityProviderConnection);
      await provider.run();
      expect(entityProviderConnection.applyMutation).toBeCalledWith({
        type: 'full',
        entities: [
          expect.objectContaining({
            entity: expect.objectContaining({
              kind: 'Group',
              metadata: expect.objectContaining({
                name: 'group1',
              }),
              spec: expect.objectContaining({
                members: ['asdfwefwefwef'],
              }),
            }),
          }),
        ],
      });
    });
  });

  describe('where there is a group', () => {
    beforeEach(() => {
      listGroups = () => {
        return new MockOktaCollection([
          {
            id: 'asdfwefwefwef',
            profile: {
              name: 'Everyone@the-company',
              description: 'Everyone in the company',
            },
            listUsers: () => {
              return new MockOktaCollection([
                {
                  id: 'asdfwefwefwef',
                  profile: {
                    email: 'fname@domain.com',
                  },
                },
              ]);
            },
          },
        ]);
      };
    });

    it('creates okta groups', async () => {
      const entityProviderConnection: EntityProviderConnection = {
        applyMutation: jest.fn(),
      };
      const provider = OktaGroupEntityProvider.fromConfig(config, { logger });
      provider.connect(entityProviderConnection);
      await provider.run();
      expect(entityProviderConnection.applyMutation).toBeCalledWith({
        type: 'full',
        entities: [
          expect.objectContaining({
            entity: expect.objectContaining({
              kind: 'Group',
              metadata: expect.objectContaining({
                name: 'asdfwefwefwef',
              }),
              spec: expect.objectContaining({
                members: ['asdfwefwefwef'],
              }),
            }),
          }),
        ],
      });
    });

    it('allows kebab casing of the group name and user name for the name', async () => {
      const entityProviderConnection: EntityProviderConnection = {
        applyMutation: jest.fn(),
      };
      const provider = OktaGroupEntityProvider.fromConfig(config, {
        logger,
        namingStrategy: 'kebab-case-name',
        userNamingStrategy: 'strip-domain-email',
      });
      provider.connect(entityProviderConnection);
      await provider.run();
      expect(entityProviderConnection.applyMutation).toBeCalledWith({
        type: 'full',
        entities: [
          expect.objectContaining({
            entity: expect.objectContaining({
              kind: 'Group',
              metadata: expect.objectContaining({
                name: 'everyone-the-company',
              }),
              spec: expect.objectContaining({
                members: ['fname'],
              }),
            }),
          }),
        ],
      });
    });
  });
});
