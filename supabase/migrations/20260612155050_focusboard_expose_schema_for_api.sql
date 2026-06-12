alter role authenticator
  set pgrst.db_schemas = 'public, storage, graphql_public, focusboard';

notify pgrst, 'reload config';
