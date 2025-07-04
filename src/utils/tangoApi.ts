// src/utils/tangoApi.ts
import NodeCache from 'node-cache';
import axios from 'axios';

const cache = new NodeCache({ stdTTL: 1800 }); // cache for 30 mins

const getEnvVars = () => ({
  TANGO_BASE_URL: process.env.TANGO_BASE_URL!,
  TANGO_USERNAME: process.env.TANGO_USERNAME!,
  TANGO_PASSWORD: process.env.TANGO_PASSWORD!,
  TANGO_ACCOUNT: process.env.TANGO_ACCOUNT!,
  TANGO_CUSTOMER: process.env.TANGO_CUSTOMER!,
});

const getAuthHeader = () => {
  const { TANGO_USERNAME, TANGO_PASSWORD } = getEnvVars();
  return {
    Authorization: 'Basic ' + Buffer.from(`${TANGO_USERNAME}:${TANGO_PASSWORD}`).toString('base64'),
    'Content-Type': 'application/json',
  };
};

interface TangoBrand {
  brandKey: string;
  items: { utid: string }[];
  imageUrls?: string[];
  displayName?: string;
}

interface TangoCatalog {
  brands: TangoBrand[];
}

export const fetchCatalog = async (): Promise<TangoCatalog> => {
  const cachedCatalog = cache.get<TangoCatalog>('tangoCatalog');
  if (cachedCatalog) {
    console.log('[TANGO] Returning cached catalog');
    return cachedCatalog;
  }

  const { TANGO_BASE_URL } = getEnvVars();
  const AUTH_HEADER = getAuthHeader();

  const res = await axios.get(`${TANGO_BASE_URL}/catalogs`, { headers: AUTH_HEADER });

  const catalog = res.data as TangoCatalog;
  cache.set('tangoCatalog', catalog);
  console.log('[TANGO] Fetched new catalog and cached it');

  return catalog;
};

export const placeOrder = async ({
  email,
  brandKey,
  value,
  firstName,
  lastName,
}: {
  email: string;
  brandKey: string;
  value: number;
  firstName: string;
  lastName: string;
}) => {
  const { TANGO_BASE_URL, TANGO_CUSTOMER, TANGO_ACCOUNT } = getEnvVars();
  const AUTH_HEADER = getAuthHeader();
  const utid = await getUTIDFromBrandKey(brandKey);

  const payload = {
    accountIdentifier: TANGO_ACCOUNT,
    customerIdentifier: TANGO_CUSTOMER,
    amount: value,
    utid,
    recipient: {
      email,
      firstName,
      lastName,
    },
    sendEmail: true,
  };

  const res = await axios.post(`${TANGO_BASE_URL}/orders`, payload, { headers: AUTH_HEADER });
  return res.data;
};

const getUTIDFromBrandKey = async (brandKey: string): Promise<string> => {
  const catalog = await fetchCatalog();
  const brand = catalog.brands.find((b: any) => b.brandKey === brandKey);
  if (!brand || !brand.items?.[0]?.utid) {
    throw new Error('Invalid brand key or UTID not found.');
  }
  return brand.items[0].utid;
};
