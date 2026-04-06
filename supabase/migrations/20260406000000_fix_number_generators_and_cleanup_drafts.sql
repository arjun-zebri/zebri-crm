-- Fix generate_quote_number to handle non-numeric quote_number values
  create or replace function generate_quote_number(p_user_id uuid)
  returns text language plpgsql as $$     
  declare
    next_num integer;                                                                                                                                      
  begin                                       
    select coalesce(                                                                                                                                       
      max(cast(nullif(regexp_replace(quote_number, '[^0-9]', '', 'g'), '') as integer)),
      0                                                                                                                                                    
    ) + 1
    into next_num                                                                                                                                          
    from quotes                                             
    where user_id = p_user_id;
    return 'QT-' || lpad(next_num::text, 3, '0');
  end;                                    
  $$;
                                                                                                                                                           
  -- Fix generate_invoice_number
  create or replace function generate_invoice_number(p_user_id uuid)                                                                                       
  returns text language plpgsql as $$                       
  declare                                 
    next_num integer;
  begin                                                                                                                                                    
    select coalesce(
      max(cast(nullif(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') as integer)),                                                                 
      0                                                     
    ) + 1                                 
    into next_num
    from invoices                                                                                                                                          
    where user_id = p_user_id;
    return 'INV-' || lpad(next_num::text, 3, '0');                                                                                                         
  end;                                                      
  $$;
                                              
  -- Clean up orphaned draft rows         
  delete from quotes where quote_number = 'DRAFT';
  delete from invoices where invoice_number = 'DRAFT';  