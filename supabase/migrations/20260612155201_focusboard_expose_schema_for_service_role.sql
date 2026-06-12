alter role service_role
  set pgrst.db_schemas = 'public, storage, graphql_public, focusboard';

notify pgrst, 'reload config';
