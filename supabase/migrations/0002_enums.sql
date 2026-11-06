create type email_status    as enum ('queued','processing','processed','skipped',
                                     'skipped_no_datetime','failed','failed_schema');
create type event_category  as enum ('careers','talks','workshops','competitions',
                                     'networking','culture','sports');
create type location_kind   as enum ('physical','online','hybrid','unknown');
create type reg_status      as enum ('draft','awaiting_input','ready','opened_form',
                                     'submitted_by_user','confirmed','failed','abandoned');
create type field_state     as enum ('prefilled','needs_input','optional_missing','unmapped');
create type job_status      as enum ('queued','running','succeeded','failed','cancelled');
create type account_status  as enum ('active','revoked','error');
create type form_family     as enum ('qualtrics','google_forms','ms_forms',
                                     'eventbrite','typeform','unknown');
