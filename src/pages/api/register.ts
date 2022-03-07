import { NextApiRequest, NextApiResponse } from 'next';
import database from '../../utils/database';
import { sessionAPI } from '../../utils/session';
import { hash } from '../../utils/encryption';
import config from '../../../openrpg.config.json';
import { Player } from '@prisma/client';

function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') return handlePost(req, res);
  res.status(404).end();
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const username = req.body.username as string;
  const plainPassword = req.body.password as string;
  const adminKey = req.body.adminKey as string;

  if (!username || !plainPassword) {
    res.status(401).send({ message: 'Username or password is blank.' });
    return;
  }

  const user = await database.player.findFirst({ where: { username } });

  if (user) {
    res.status(401).send({ message: 'Username already exists.' });
    return;
  }

  let isAdmin = false;
  if (adminKey) {
    if (adminKey === config.player.admin_key) {
      isAdmin = true;
    }
    else {
      res.status(401).send({ message: 'Admin key is incorrect.' });
      return;
    }
  }

  const hashword = hash(plainPassword);

  const player = await database.player.create({
    data: {
      username,
      password: hashword,
      role: isAdmin ? 'ADMIN' : 'PLAYER'
    }
  });

  if (isAdmin) await registerAdminData(player);
  else await registerPlayerData(player);

  req.session.player = {
    id: player.id,
    admin: isAdmin
  };
  await req.session.save();

  res.json({ id: player.id });
}

async function registerPlayerData(player: Player) {
  const results = await Promise.all([
    database.info.findMany(),
    database.attribute.findMany(),
    database.attributeStatus.findMany(),
    database.spec.findMany(),
    database.characteristic.findMany(),

  ]);

  await Promise.all([
    database.playerInfo.createMany({
      data: results[0].map(info => {
        return {
          info_id: info.id,
          player_id: player.id,
          value: ''
        };
      })
    }),
    database.playerAttribute.createMany({
      data: results[1].map(attr => {
        return {
          player_id: player.id,
          attribute_id: attr.id,
          value: 0,
          maxValue: 0
        };
      })
    }),
    database.playerAttributeStatus.createMany({
      data: results[2].map(attrStatus => {
        return {
          player_id: player.id,
          attribute_status_id: attrStatus.id,
          value: false
        };
      })
    }),
    database.playerSpec.createMany({
      data: results[3].map(spec => {
        return {
          player_id: player.id,
          spec_id: spec.id,
          value: ''
        };
      })
    }),
    database.playerCharacteristic.createMany({
      data: results[4].map(char => {
        return {
          player_id: player.id,
          characteristic_id: char.id,
          value: 0
        };
      })
    }),
  ]);
}

async function registerAdminData(admin: Player) {

}

export default sessionAPI(handler);